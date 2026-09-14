"""Section 9 -- Admin Dashboard. Gives a system-wide overview without
bypassing controlled workflows (every widget here is read-only)."""
import datetime as dt
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as OrmSession

from .. import models
from ..database import get_db
from ..deps import get_current_user
from ..serialize import to_list

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: OrmSession = Depends(get_db), user: models.User = Depends(get_current_user)):
    orders = db.query(models.ProductionOrder).all()
    machines = db.query(models.Machine).all()
    material_holds = db.query(models.MaterialBatch).filter(models.MaterialBatch.status == "ON_HOLD").count()
    quality_holds = db.query(models.QualityHold).filter(models.QualityHold.status.in_(["OPEN", "PENDING"])).count()
    critical_alerts = db.query(models.Alert).filter(models.Alert.severity == "CRITICAL", models.Alert.status.in_(["NEW", "ACKNOWLEDGED", "IN_PROGRESS"])).all()
    delayed_orders = [o for o in orders if o.status == "DELAYED"]
    open_incidents = db.query(models.Incident).filter(models.Incident.status.notin_(["CLOSED"])).count()

    status_counts = Counter(o.status for o in orders)
    machine_counts = Counter(m.status for m in machines)

    recent_conflicts = db.query(models.SchedulingConflictLog).order_by(models.SchedulingConflictLog.created_at.desc()).limit(8).all()

    stale_machines = [m for m in machines if m.is_stale]
    stale_runs = db.query(models.ProductionRun).filter(models.ProductionRun.is_stale == True).all()  # noqa: E712

    # Identify developing line-stop bottlenecks (runs impacted by held batches, faulted equipment, or overdue orders)
    active_runs = db.query(models.ProductionRun).filter(
        models.ProductionRun.status.in_(["SCHEDULED", "RUNNING", "PAUSED", "ON_HOLD", "MATERIAL_SUBSTITUTION_PENDING"])
    ).all()
    now_utc = dt.datetime.utcnow()
    developing_bottlenecks = []
    for r in active_runs:
        held_batches = [
            {
                "batchId": c.batch_id,
                "lotNumber": c.batch.lot_number if c.batch else None,
                "materialName": c.material.name if c.material else None,
                "quantityReserved": float(c.quantity_reserved or 0),
                "status": c.batch.status if c.batch else None,
            }
            for c in r.consumptions if c.batch and c.batch.status == "ON_HOLD"
        ]
        is_machine_issue = bool(r.machine and (r.machine.status in ("FAULT", "MAINTENANCE") or r.machine.is_stale))
        is_order_overdue = bool(r.order and r.order.due_date and r.order.due_date < now_utc)
        is_sub_needed = r.status in ("MATERIAL_SUBSTITUTION_PENDING", "ON_HOLD")

        if held_batches or is_machine_issue or is_order_overdue or is_sub_needed:
            severity = "CRITICAL" if held_batches or (r.machine and r.machine.status == "FAULT") else "HIGH"
            root_cause_type = "MATERIAL_BATCH" if held_batches else ("MACHINE" if is_machine_issue else "PRODUCTION_ORDER")
            root_cause_id = held_batches[0]["batchId"] if held_batches else (r.machine_id if is_machine_issue else r.order_id)
            developing_bottlenecks.append({
                "runId": r.id,
                "runCode": r.code,
                "runStatus": r.status,
                "orderId": r.order_id,
                "orderCode": r.order.code if r.order else None,
                "productName": r.order.product_name if r.order else None,
                "isOverdue": is_order_overdue,
                "dueDate": r.order.due_date.isoformat() if r.order and r.order.due_date else None,
                "machineId": r.machine_id,
                "machineName": r.machine.name if r.machine else None,
                "machineStatus": r.machine.status if r.machine else None,
                "operatorId": r.operator_id,
                "operatorName": r.operator.user.name if r.operator and r.operator.user else None,
                "operatorCode": r.operator.employee_code if r.operator else None,
                "heldBatches": held_batches,
                "severity": severity,
                "rootCauseType": root_cause_type,
                "rootCauseId": root_cause_id,
            })

    return {
        "kpis": {
            "activeOrders": len([o for o in orders if o.status in ("APPROVED", "READY", "RUNNING", "DELAYED")]),
            "runningMachines": machine_counts.get("RUNNING", 0),
            "availableMachines": machine_counts.get("AVAILABLE", 0),
            "materialHolds": material_holds,
            "qualityHolds": quality_holds,
            "criticalAlerts": len(critical_alerts),
            "delayedOrders": len(delayed_orders),
            "openIncidents": open_incidents,
        },
        "developingBottlenecks": developing_bottlenecks,
        "productionStatus": dict(status_counts),
        "machineStatus": dict(machine_counts),
        "criticalAlertsList": to_list(critical_alerts),
        "resourceConflicts": to_list(recent_conflicts),
        "staleness": {
            "machines": [{"id": m.id, "name": m.name, "lastHeartbeatAt": m.last_heartbeat_at.isoformat() if m.last_heartbeat_at else None} for m in stale_machines],
            "runs": [{"id": r.id, "code": r.code, "lastHeartbeatAt": r.last_heartbeat_at.isoformat() if r.last_heartbeat_at else None} for r in stale_runs],
        },
        "generatedAt": dt.datetime.utcnow().isoformat(),
    }
