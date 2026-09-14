"""Unit tests for risk engine scoring, proactive auto-hold, and material hold cascades."""
import unittest
import datetime as dt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app import models
from app.risk_engine import combine_factors
from app.routers.materials import _cascade_hold_impact


class TestRiskEngineAndHolds(unittest.TestCase):
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
        self.user = models.User(name="Manager", email="mgr@pcts.demo", username="mgr", password_hash="hash")
        self.proc = models.Process(name="P1")
        self.db.add_all([self.user, self.proc])
        self.db.flush()

        self.step = models.ProcessStep(process_id=self.proc.id, sequence_number=1, name="S1")
        self.mat = models.Material(name="Steel Bar", unit_of_measure="KG")
        self.db.add_all([self.step, self.mat])
        self.db.flush()

        self.batch = models.MaterialBatch(
            material_id=self.mat.id, lot_number="LOT-007", total_quantity=100, status="AVAILABLE"
        )
        self.order = models.ProductionOrder(
            code="PO-999", product_name="Assembly", quantity_ordered=50,
            process_id=self.proc.id, due_date=dt.datetime.utcnow() + dt.timedelta(days=1), status="RUNNING"
        )
        self.db.add_all([self.batch, self.order])
        self.db.flush()

        self.run = models.ProductionRun(
            code="PR-999", order_id=self.order.id, process_step_id=self.step.id,
            status="RUNNING"
        )
        self.db.add(self.run)
        self.db.flush()

        # Reserve batch for this run
        self.res = models.ResourceReservation(
            run_id=self.run.id, resource_type="MATERIAL_BATCH", resource_id=self.batch.id,
            quantity_reserved=50, status="ACTIVE"
        )
        self.consumption = models.RunMaterialConsumption(
            run_id=self.run.id, batch_id=self.batch.id, material_id=self.mat.id,
            quantity_reserved=50, quantity_consumed=None
        )
        self.db.add_all([self.res, self.consumption])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_risk_scoring_formula(self):
        """Risk calculation picks max per category and sums up correctly."""
        # DEADLINE_CLOSE (20, SCHEDULE) + PREDICTED_DEADLINE_MISS (30, SCHEDULE)
        # Category max for SCHEDULE should be 30, not 50!
        res = combine_factors(["DEADLINE_CLOSE", "PREDICTED_DEADLINE_MISS"])
        self.assertEqual(res["score"], 30)
        self.assertEqual(res["classification"], "MEDIUM")

        # Add MACHINE_FAULT (30, MACHINE_HEALTH) + QUALITY_HOLD (30, QUALITY)
        # Total = 30 (SCHEDULE) + 30 (MACHINE_HEALTH) + 30 (QUALITY) = 90 (CRITICAL)
        res_crit = combine_factors(["PREDICTED_DEADLINE_MISS", "MACHINE_FAULT", "QUALITY_HOLD"])
        self.assertEqual(res_crit["score"], 90)
        self.assertEqual(res_crit["classification"], "CRITICAL")
        self.assertIsNotNone(res_crit["auto_hold_trigger"])

    def test_cascade_material_hold_stops_running_run(self):
        """Placing a reserved material batch ON_HOLD automatically transitions dependent running run to ON_HOLD."""
        self.assertEqual(self.run.status, "RUNNING")

        # Trigger cascade hold on batch
        self.batch.status = "ON_HOLD"
        _cascade_hold_impact(self.db, self.batch, self.user, reason="Contamination suspected")
        self.db.commit()

        # Verify run was automatically suspended to ON_HOLD
        updated_run = self.db.get(models.ProductionRun, self.run.id)
        self.assertEqual(updated_run.status, "ON_HOLD")

        # Verify alert was raised
        alert = self.db.query(models.Alert).filter(
            models.Alert.affected_run_id == self.run.id,
            models.Alert.type == "MATERIAL_HOLD_IMPACT"
        ).first()
        self.assertIsNotNone(alert)
        self.assertEqual(alert.severity, "HIGH")
        self.assertIn("LOT-007", alert.message)


if __name__ == "__main__":
    unittest.main()
