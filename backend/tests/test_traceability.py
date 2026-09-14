"""Unit tests for backward genealogy, forward recall, and root-cause timelines."""
import unittest
import datetime as dt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app import models
from app.routers.traceability import _run_node, _build_timeline


class TestTraceabilityAndGenealogy(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed master entities
        self.dep = models.Department(name="Manufacturing")
        self.db.add(self.dep)
        self.db.flush()

        self.user_op = models.User(
            name="John Operator", email="john@example.com", username="john_op", password_hash="dummy"
        )
        self.db.add(self.user_op)
        self.db.flush()

        self.operator = models.Operator(user_id=self.user_op.id, employee_code="OP-101")
        self.machine = models.Machine(name="CNC-ALPHA", status="RUNNING", capacity=120)
        self.proc = models.Process(name="Bracket Machining")
        self.db.add_all([self.operator, self.machine, self.proc])
        self.db.flush()

        self.step = models.ProcessStep(process_id=self.proc.id, sequence_number=1, name="Milling")
        self.db.add(self.step)
        self.db.flush()

        self.material = models.Material(name="Aluminum 6061", unit_of_measure="KG")
        self.db.add(self.material)
        self.db.flush()

        now = dt.datetime.utcnow()
        self.batch = models.MaterialBatch(
            material_id=self.material.id, lot_number="ALU-LOT-99", total_quantity=500,
            status="AVAILABLE", received_date=now - dt.timedelta(days=5)
        )
        self.db.add(self.batch)
        self.db.flush()

        self.order = models.ProductionOrder(
            code="PO-555", product_name="Widget Pro", quantity_ordered=200,
            process_id=self.proc.id, due_date=now + dt.timedelta(days=2), status="RUNNING"
        )
        self.db.add(self.order)
        self.db.flush()

        self.run = models.ProductionRun(
            code="PR-888", order_id=self.order.id, process_step_id=self.step.id,
            machine_id=self.machine.id, operator_id=self.operator.id,
            scheduled_start=now - dt.timedelta(hours=4), scheduled_end=now - dt.timedelta(hours=2),
            actual_start=now - dt.timedelta(hours=4), status="RUNNING"
        )
        self.db.add(self.run)
        self.db.flush()

        self.consumption = models.RunMaterialConsumption(
            run_id=self.run.id, batch_id=self.batch.id, material_id=self.material.id,
            quantity_reserved=50, quantity_consumed=48,
            reserved_at=now - dt.timedelta(hours=4), consumed_at=now - dt.timedelta(hours=3)
        )
        self.db.add(self.consumption)
        self.db.flush()

        self.pb = models.ProductBatch(
            code="PB-333", order_id=self.order.id, run_id=self.run.id,
            quantity_produced=100, quality_disposition="ON_HOLD"
        )
        self.db.add(self.pb)
        self.db.flush()

        self.defect = models.Defect(
            code="DEF-01", target_type="PRODUCT_BATCH", target_id=self.pb.id,
            severity="MAJOR", description="Surface roughness exceeded specification",
            detected_at=now - dt.timedelta(hours=1)
        )
        self.db.add(self.defect)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_run_node_genealogy_details(self):
        """_run_node accurately links machine, operator, and raw materials consumed."""
        node = _run_node(self.db, self.run)
        self.assertEqual(node["runCode"], "PR-888")
        self.assertEqual(node["machineName"], "CNC-ALPHA")
        self.assertEqual(node["operatorName"], "John Operator")
        self.assertEqual(node["operatorCode"], "OP-101")
        self.assertEqual(len(node["materialBatches"]), 1)
        self.assertEqual(node["materialBatches"][0]["lotNumber"], "ALU-LOT-99")
        self.assertEqual(node["materialBatches"][0]["quantityConsumed"], 48.0)

    def test_event_timeline_sequence(self):
        """Timeline must capture milestone events in ascending chronological order."""
        timeline = _build_timeline(
            self.db, entity_type="PRODUCTION_RUN", entity_id=self.run.id, run=self.run
        )
        self.assertTrue(len(timeline) >= 2)
        # Check that events are sorted chronologically
        timestamps = [e["timestamp"] for e in timeline]
        self.assertEqual(timestamps, sorted(timestamps))

        # Check that material reserved and run started are present
        titles = [e["title"] for e in timeline]
        self.assertTrue(any("Run PR-888 Started" in t for t in titles))
        self.assertTrue(any("Material Consumed" in t or "Material Reserved" in t for t in titles))


if __name__ == "__main__":
    unittest.main()
