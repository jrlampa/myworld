import unittest
import sys
import os
from pathlib import Path

# Fix path to include py_engine
sys.path.append(str(Path(__file__).parent.parent))

from py_engine.utils.topography_service import TopographyService

class TestTopographyService(unittest.TestCase):
    def setUp(self):
        self.service = TopographyService()

    def test_quality_to_samples(self):
        self.assertEqual(self.service._quality_to_samples("ultra"), 32)
        self.assertEqual(self.service._quality_to_samples("high"), 16)
        self.assertEqual(self.service._quality_to_samples("low"), 8)

    def test_grid_size_calculation(self):
        # 500m radius -> 1000m diameter. Res 30m -> ~33 size
        size = self.service._get_grid_size(500, "high")
        self.assertGreaterEqual(size, 30)
        self.assertLessEqual(size, 150)

    def test_local_projector(self):
        # Test coordinates (-22.15, -42.92)
        projector = self.service.build_local_projector(-22.15018, -42.92185)
        # Center should be (0, 0)
        x, y = projector(-22.15018, -42.92185)
        self.assertAlmostEqual(x, 0, places=1)
        self.assertAlmostEqual(y, 0, places=1)

if __name__ == "__main__":
    unittest.main()
