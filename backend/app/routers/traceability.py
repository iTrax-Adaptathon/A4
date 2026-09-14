"""Section 37 -- Traceability Administration (REVISED for multi-batch
genealogy, Section 16). Supports the Traceability Explorer searches by
Order/Run/ProductBatch/MaterialBatch/Machine/Operator/Defect/Incident ID,
and the forward-recall query pattern of Acceptance Test AT-4."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session as OrmSession

from .. import models
from ..database import get_db
from ..deps import require_permission
from ..serialize import to_dict, to_list

router = APIRouter(prefix="/v1/traceability", tags=["traceability"])


def _run_node(db, run: models.ProductionRun):
    return {
        "runId": run.id, "runCode": run.code, "status": run.status,
        "orderId": run.order_id, "orderCode": run.order.code if run.order else None,
        "machineId": run.machine_id, "machineName": run.machine.name if run.machine else None,
        "operatorId": run.operator_id, "operatorName": run.operator.user.name if run.operator and run.operator.user else None,
        "operatorCode": run.operator.employee_code if run.operator else None,
        "processStepId": run.process_step_id, "processStepName": run.process_step.name if run.process_step else None,
        "scheduledStart": run.scheduled_start.isoformat() if run.scheduled_start else None,
        "scheduledEnd": run.scheduled_end.isoformat() if run.scheduled_end else None,
        "actualStart": run.actual_start.isoformat() if run.actual_start else None,
        "actualEnd": run.actual_end.isoformat() if run.actual_end else None,
        "materialBatches": [
            {"batchId": c.batch_id, "lotNumber": c.batch.lot_number if c.batch else None,
             "materialName": c.material.name if c.material else None, "role": c.role,
             "status": c.batch.status if c.batch else None,
             "quantityReserved": float(c.quantity_reserved or 0), "quantityConsumed": float(c.quantity_consumed) if c.quantity_consumed is not None else None}
            for c in run.consumptions
        ],
        "productBatches": [{"productBatchId": pb.id, "code": pb.code, "quantityProduced": float(pb.quantity_produced or 0),
                             "qualityDisposition": pb.quality_disposition} for pb in run.product_batches],
        "inspections": to_list(db.query(models.QualityInspection).filter(models.QualityInspection.run_id == run.id).all()),
    }


def _build_timeline(db: OrmSession, *, entity_type: str, entity_id: str, run: models.ProductionRun = None, batch_id: str = None, machine_id: str = None, order_id: str = None):
    events = []

    # 1. Audit logs for this entity and related run/order
    audit_filter = (models.AuditLog.entity_id == entity_id)
    if run:
        audit_filter = or_(audit_filter, (models.AuditLog.entity_id == run.id), (models.AuditLog.entity_id == run.order_id))
    for log in db.query(models.AuditLog).filter(audit_filter).order_by(models.AuditLog.timestamp).all():
        action_name = (log.action or "").replace("_", " ").title()
        events.append({
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "type": "AUDIT_LOG",
            "title": f"Audit: {action_name}",
            "detail": log.reason or (f"Action on {log.entity_type} {log.entity_id}" if log.entity_type else ""),
            "severity": "CRITICAL" if any(k in (log.action or "") for k in ["HOLD", "FAULT", "REJECT"]) else "LOW",
        })

    # 2. Run milestones
    if run:
        if run.created_at:
            events.append({
                "timestamp": run.created_at.isoformat(),
                "type": "RUN_SCHEDULED",
                "title": f"Run {run.code} Scheduled",
                "detail": f"Machine: {run.machine.name if run.machine else 'None'}, Operator: {run.operator.user.name if run.operator and run.operator.user else 'None'}.",
                "severity": "LOW",
            })
        if run.actual_start:
            events.append({
                "timestamp": run.actual_start.isoformat(),
                "type": "RUN_STARTED",
                "title": f"Run {run.code} Started",
                "detail": f"Production commenced on machine {run.machine.name if run.machine else run.machine_id}.",
                "severity": "LOW",
            })
        if run.actual_end:
            events.append({
                "timestamp": run.actual_end.isoformat(),
                "type": "RUN_ENDED",
                "title": f"Run {run.code} Completed",
                "detail": f"Completed with status {run.status}.",
                "severity": "LOW",
            })

    # 3. Material consumptions
    if run:
        for c in run.consumptions:
            if c.reserved_at:
                events.append({
                    "timestamp": c.reserved_at.isoformat(),
                    "type": "MATERIAL_RESERVED",
                    "title": f"Material Reserved: {c.material.name if c.material else 'Material'}",
                    "detail": f"Reserved {float(c.quantity_reserved or 0)} from lot {c.batch.lot_number if c.batch else c.batch_id}.",
                    "severity": "LOW",
                })
            if c.consumed_at:
                events.append({
                    "timestamp": c.consumed_at.isoformat(),
                    "type": "MATERIAL_CONSUMED",
                    "title": f"Material Consumed: {c.material.name if c.material else 'Material'}",
                    "detail": f"Consumed {float(c.quantity_consumed or 0)} from lot {c.batch.lot_number if c.batch else c.batch_id}.",
                    "severity": "LOW",
                })

    # 4. Holds
    b_id = batch_id or (run.consumptions[0].batch_id if run and run.consumptions else None)
    if b_id:
        for hold in db.query(models.QualityHold).filter(models.QualityHold.target_id == b_id).all():
            events.append({
                "timestamp": hold.created_at.isoformat() if hold.created_at else None,
                "type": "QUALITY_HOLD",
                "title": f"Quality Hold ({hold.target_type})",
                "detail": f"Reason: {hold.reason} [Status: {hold.status}]",
                "severity": "HIGH",
            })

    # 5. Alerts
    alert_filter_conds = []
    if run:
        alert_filter_conds.append(models.Alert.affected_run_id == run.id)
    if order_id or (run and run.order_id):
        alert_filter_conds.append(models.Alert.affected_order_id == (order_id or run.order_id))
    if machine_id or (run and run.machine_id):
        alert_filter_conds.append(models.Alert.affected_resource_id == (machine_id or run.machine_id))
    if b_id:
        alert_filter_conds.append(models.Alert.affected_resource_id == b_id)
    if alert_filter_conds:
        for alert in db.query(models.Alert).filter(or_(*alert_filter_conds)).all():
            events.append({
                "timestamp": alert.created_at.isoformat() if alert.created_at else None,
                "type": f"ALERT_{alert.type}",
                "title": f"Alert [{alert.severity}]: {alert.type}",
                "detail": alert.message,
                "severity": alert.severity,
            })

    # 6. Incidents
    inc_filter_conds = []
    if entity_type == "INCIDENT":
        inc_filter_conds.append(models.Incident.id == entity_id)
    if run:
        inc_filter_conds.append(models.Incident.run_id == run.id)
    if machine_id or (run and run.machine_id):
        inc_filter_conds.append(models.Incident.machine_id == (machine_id or run.machine_id))
    if b_id:
        inc_filter_conds.append(models.Incident.batch_id == b_id)
    if inc_filter_conds:
        for inc in db.query(models.Incident).filter(or_(*inc_filter_conds)).all():
            events.append({
                "timestamp": inc.detected_at.isoformat() if inc.detected_at else None,
                "type": "INCIDENT",
                "title": f"Incident Detected: {inc.code} ({inc.type})",
                "detail": inc.description,
                "severity": inc.severity,
            })

    # 7. Defects
    if run and run.product_batches:
        pb_ids = [pb.id for pb in run.product_batches]
        for defect in db.query(models.Defect).filter(models.Defect.target_id.in_(pb_ids)).all():
            events.append({
                "timestamp": defect.detected_at.isoformat() if defect.detected_at else None,
                "type": "DEFECT",
                "title": f"Defect Detected: {defect.code} ({defect.severity})",
                "detail": defect.description,
                "severity": defect.severity,
            })

    valid_events = [e for e in events if e.get("timestamp")]
    seen = set()
    deduped = []
    for e in valid_events:
        key = (e["timestamp"], e["title"], e["detail"])
        if key not in seen:
            seen.add(key)
            deduped.append(e)
    deduped.sort(key=lambda x: x["timestamp"])
    return deduped


@router.get("/lookup")
def lookup(
    q: str = "",
    db: OrmSession = Depends(get_db),
    user=Depends(require_permission("VIEW_TRACEABILITY_ALL", "VIEW_TRACEABILITY_LIMITED")),
):
    """Find traceable records by the reference people see in the UI.

    The former Explorer required an opaque database UUID and a separately
    selected entity type.  This endpoint deliberately returns only entity
    kinds handled by ``trace`` below, so every result can be opened directly
    in the Explorer.
    """
    query = q.strip()
    if len(query) < 2:
        return {"items": []}

    like = f"%{query}%"
    items = []

    def add(entity_type, entity_id, reference, description, status):
        items.append({
            "entityType": entity_type,
            "id": entity_id,
            "reference": reference,
            "description": description,
            "status": status,
        })

    for order in db.query(models.ProductionOrder).filter(
        or_(models.ProductionOrder.code.ilike(like), models.ProductionOrder.product_name.ilike(like))
    ).order_by(models.ProductionOrder.code).limit(8):
        add("PRODUCTION_ORDER", order.id, order.code, order.product_name, order.status)

    for run in db.query(models.ProductionRun).filter(
        models.ProductionRun.code.ilike(like)
    ).order_by(models.ProductionRun.code).limit(8):
        add("PRODUCTION_RUN", run.id, run.code, run.order.code if run.order else "Production run", run.status)

    for batch in db.query(models.ProductBatch).filter(
        models.ProductBatch.code.ilike(like)
    ).order_by(models.ProductBatch.code).limit(8):
        add("PRODUCT_BATCH", batch.id, batch.code, batch.order.product_name if batch.order else "Product batch", batch.quality_disposition)

    for batch in db.query(models.MaterialBatch).filter(
        models.MaterialBatch.lot_number.ilike(like)
    ).order_by(models.MaterialBatch.lot_number).limit(8):
        add("MATERIAL_BATCH", batch.id, batch.lot_number, batch.material.name if batch.material else "Material batch", batch.status)

    for machine in db.query(models.Machine).filter(
        models.Machine.name.ilike(like)
    ).order_by(models.Machine.name).limit(8):
        add("MACHINE", machine.id, machine.name, machine.type or "Machine", machine.status)

    for operator in db.query(models.Operator).join(models.User).filter(
        or_(models.Operator.employee_code.ilike(like), models.User.name.ilike(like))
    ).order_by(models.Operator.employee_code).limit(8):
        add("OPERATOR", operator.id, operator.employee_code or operator.user.name, operator.user.name if operator.user else "Operator", None)

    for defect in db.query(models.Defect).filter(
        models.Defect.code.ilike(like)
    ).order_by(models.Defect.code).limit(8):
        add("DEFECT", defect.id, defect.code, defect.category or "Defect", defect.status)

    for incident in db.query(models.Incident).filter(
        or_(models.Incident.code.ilike(like), models.Incident.description.ilike(like))
    ).order_by(models.Incident.code).limit(8):
        add("INCIDENT", incident.id, incident.code, incident.type or "Incident", incident.status)

    return {"items": items[:25]}


@router.get("/{entity_type}/{entity_id}")
def trace(entity_type: str, entity_id: str, db: OrmSession = Depends(get_db), user=Depends(require_permission("VIEW_TRACEABILITY_ALL", "VIEW_TRACEABILITY_LIMITED"))):
    entity_type = entity_type.upper()

    if entity_type == "PRODUCT_BATCH":
        pb = db.get(models.ProductBatch, entity_id)
        if not pb:
            raise HTTPException(404, "Product batch not found.")
        run = db.get(models.ProductionRun, pb.run_id)
        return {
            "entityType": "PRODUCT_BATCH", "productBatch": to_dict(pb),
            "run": _run_node(db, run) if run else None,
            "defects": to_list(db.query(models.Defect).filter(models.Defect.target_id == pb.id, models.Defect.target_type == "PRODUCT_BATCH").all()),
            "timeline": _build_timeline(db, entity_type="PRODUCT_BATCH", entity_id=pb.id, run=run),
        }

    if entity_type == "MATERIAL_BATCH":
        mb = db.get(models.MaterialBatch, entity_id)
        if not mb:
            raise HTTPException(404, "Material batch not found.")
        consumptions = db.query(models.RunMaterialConsumption).filter(models.RunMaterialConsumption.batch_id == mb.id).all()
        runs = []
        seen_run_ids = set()
        product_batches = []
        primary_run = None
        for c in consumptions:
            if c.run_id in seen_run_ids:
                continue
            seen_run_ids.add(c.run_id)
            run = db.get(models.ProductionRun, c.run_id)
            if run:
                if not primary_run:
                    primary_run = run
                runs.append(_run_node(db, run))
                product_batches.extend(pb.id for pb in run.product_batches)
        return {
            "entityType": "MATERIAL_BATCH", "materialBatch": to_dict(mb, {"availableQuantity": float(mb.available_quantity())}),
            "forwardRecall": {"affectedRuns": runs, "affectedProductBatchIds": product_batches, "affectedOrderIds": list({r["orderId"] for r in runs})},
            "timeline": _build_timeline(db, entity_type="MATERIAL_BATCH", entity_id=mb.id, batch_id=mb.id, run=primary_run),
        }

    if entity_type in ("RUN", "PRODUCTION_RUN"):
        run = db.get(models.ProductionRun, entity_id)
        if not run:
            raise HTTPException(404, "Run not found.")
        return {
            "entityType": "PRODUCTION_RUN",
            "run": _run_node(db, run),
            "timeline": _build_timeline(db, entity_type="PRODUCTION_RUN", entity_id=run.id, run=run, order_id=run.order_id),
        }

    if entity_type in ("ORDER", "PRODUCTION_ORDER"):
        order = db.get(models.ProductionOrder, entity_id)
        if not order:
            raise HTTPException(404, "Order not found.")
        first_run = order.runs[0] if order.runs else None
        return {
            "entityType": "PRODUCTION_ORDER",
            "order": to_dict(order),
            "runs": [_run_node(db, r) for r in order.runs],
            "timeline": _build_timeline(db, entity_type="PRODUCTION_ORDER", entity_id=order.id, order_id=order.id, run=first_run),
        }

    if entity_type == "MACHINE":
        machine = db.get(models.Machine, entity_id)
        if not machine:
            raise HTTPException(404, "Machine not found.")
        runs = db.query(models.ProductionRun).filter(models.ProductionRun.machine_id == entity_id).all()
        return {
            "entityType": "MACHINE",
            "machine": to_dict(machine),
            "runs": [_run_node(db, r) for r in runs],
            "maintenanceHistory": to_list(machine.maintenance_records),
            "timeline": _build_timeline(db, entity_type="MACHINE", entity_id=machine.id, machine_id=machine.id),
        }

    if entity_type == "OPERATOR":
        operator = db.get(models.Operator, entity_id)
        if not operator:
            raise HTTPException(404, "Operator not found.")
        runs = db.query(models.ProductionRun).filter(models.ProductionRun.operator_id == entity_id).all()
        return {
            "entityType": "OPERATOR",
            "operator": to_dict(operator, {"name": operator.user.name if operator.user else None}),
            "runs": [_run_node(db, r) for r in runs],
            "timeline": _build_timeline(db, entity_type="OPERATOR", entity_id=operator.id),
        }

    if entity_type == "DEFECT":
        defect = db.get(models.Defect, entity_id)
        if not defect:
            raise HTTPException(404, "Defect not found.")
        node = {"entityType": "DEFECT", "defect": to_dict(defect)}
        run = None
        batch_id = None
        if defect.target_type == "PRODUCT_BATCH":
            pb = db.get(models.ProductBatch, defect.target_id)
            if pb:
                run = db.get(models.ProductionRun, pb.run_id)
                node["productBatch"] = to_dict(pb)
                node["run"] = _run_node(db, run) if run else None
        elif defect.target_type == "MATERIAL_BATCH":
            mb = db.get(models.MaterialBatch, defect.target_id)
            if mb:
                batch_id = mb.id
                node["materialBatch"] = to_dict(mb)
        node["timeline"] = _build_timeline(db, entity_type="DEFECT", entity_id=defect.id, run=run, batch_id=batch_id)
        return node

    if entity_type == "INCIDENT":
        inc = db.get(models.Incident, entity_id)
        if not inc:
            raise HTTPException(404, "Incident not found.")
        node = {"entityType": "INCIDENT", "incident": to_dict(inc)}
        run = db.get(models.ProductionRun, inc.run_id) if inc.run_id else None
        if run:
            node["run"] = _run_node(db, run)
        if inc.machine_id:
            m = db.get(models.Machine, inc.machine_id)
            if m:
                node["machine"] = to_dict(m)
        if inc.batch_id:
            mb = db.get(models.MaterialBatch, inc.batch_id)
            if mb:
                node["materialBatch"] = to_dict(mb)
        if inc.operator_id:
            op = db.get(models.Operator, inc.operator_id)
            if op:
                node["operator"] = to_dict(op, {"name": op.user.name if op.user else None})
        if inc.order_id:
            ord_obj = db.get(models.ProductionOrder, inc.order_id)
            if ord_obj:
                node["order"] = to_dict(ord_obj)
        node["timeline"] = _build_timeline(
            db, entity_type="INCIDENT", entity_id=inc.id, run=run,
            batch_id=inc.batch_id, machine_id=inc.machine_id, order_id=inc.order_id
        )
        return node

    raise HTTPException(400, f"Unsupported traceability entity type: {entity_type}")
