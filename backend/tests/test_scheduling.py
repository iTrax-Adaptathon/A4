"""Unit tests for conflict prevention, resource admission, and scheduling."""
import unittest
import datetime as dt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app import models
from app.scheduling import (
    _check_time_overlap,
    allocate_material,
    suggest_alternatives,
    SchedulingConflict,
    _run_checks,
)


class TestSchedulingAndConflictControl(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed basic process and machine
        self.proc = models.Process(name="Test Process")
        self.db.add(self.proc)
        self.db.flush()

        self.step = models.ProcessStep(
            process_id=self.proc.id, sequence_number=1, name="Step 1", standard_cycle_time=1.0
        )
        self.db.add(self.step)
        self.db.flush()

        self.machine1 = models.Machine(name="M-TEST-1", status="AVAILABLE", capacity=100)
        self.machine2 = models.Machine(name="M-TEST-2", status="AVAILABLE", capacity=100)
        self.db.add_all([self.machine1, self.machine2])
        self.db.flush()

        # Both machines capable of step 1
        self.db.add(models.MachineCapability(machine_id=self.machine1.id, process_step_id=self.step.id))
        self.db.add(models.MachineCapability(machine_id=self.machine2.id, process_step_id=self.step.id))

        # Seed material and batches
        self.mat = models.Material(name="Test Metal", unit_of_measure="KG")
        self.db.add(self.mat)
        self.db.flush()

        now = dt.datetime.utcnow()
        self.batch_avail = models.MaterialBatch(
            material_id=self.mat.id, lot_number="LOT-AVAIL", total_quantity=100, status="AVAILABLE",
            received_date=now - dt.timedelta(days=2)
        )
        self.batch_hold = models.MaterialBatch(
            material_id=self.mat.id, lot_number="LOT-HOLD", total_quantity=50, status="ON_HOLD",
            received_date=now - dt.timedelta(days=1)
        )
        self.db.add_all([self.batch_avail, self.batch_hold])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_prevent_machine_double_booking(self):
        """Active machine reservation prevents overlapping runs."""
        now = dt.datetime.utcnow()
        t_start = now + dt.timedelta(hours=1)
        t_end = now + dt.timedelta(hours=3)

        # Create active reservation on machine 1
        res = models.ResourceReservation(
            run_id="run-001", resource_type="MACHINE", resource_id=self.machine1.id,
            start_time=t_start, end_time=t_end, status="ACTIVE"
        )
        self.db.add(res)
        self.db.commit()

        # Overlapping window check
        overlap = _check_time_overlap(self.db, "MACHINE", self.machine1.id, now + dt.timedelta(hours=2), now + dt.timedelta(hours=4))
        self.assertIsNotNone(overlap)
        self.assertEqual(overlap.run_id, "run-001")

        # Non-overlapping window check
        no_overlap = _check_time_overlap(self.db, "MACHINE", self.machine1.id, now + dt.timedelta(hours=4), now + dt.timedelta(hours=6))
        self.assertIsNone(no_overlap)

    def test_material_allocation_excludes_on_hold_batches(self):
        """Batches on hold must never be allocated."""
        # LOT-HOLD has 50 KG, LOT-AVAIL has 100 KG.
        # Request 120 KG: Even though total physical stock is 150 KG, available is only 100 KG.
        allocations, shortfall = allocate_material(self.db, self.mat.id, 120)
        self.assertIsNotNone(shortfall)
        self.assertAlmostEqual(shortfall, 20.0)
        self.assertEqual(allocations, [])

        # Request 80 KG: Fits in LOT-AVAIL
        allocations, shortfall = allocate_material(self.db, self.mat.id, 80)
        self.assertIsNone(shortfall)
        self.assertEqual(len(allocations), 1)
        self.assertEqual(allocations[0][0].lot_number, "LOT-AVAIL")
        self.assertAlmostEqual(allocations[0][1], 80.0)

    def test_suggest_alternative_machine_on_conflict(self):
        """When primary machine is occupied, suggest_alternatives provides capable idle machine."""
        now = dt.datetime.utcnow()
        t_start = now + dt.timedelta(hours=1)
        t_end = now + dt.timedelta(hours=3)

        self.db.add(models.ResourceReservation(
            run_id="run-001", resource_type="MACHINE", resource_id=self.machine1.id,
            start_time=t_start, end_time=t_end, status="ACTIVE"
        ))
        self.db.commit()

        alts = suggest_alternatives(self.db, self.step.id, self.machine1.id, t_start, t_end)
        self.assertTrue(len(alts) > 0)
        # Should include machine2 as alternative
        alt_machines = [a for a in alts if a.get("type") == "ALTERNATE_MACHINE"]
        self.assertTrue(any(a["machineId"] == self.machine2.id for a in alt_machines))


if __name__ == "__main__":
    unittest.main()
