import unittest
import os
from py_engine.main import generate_dxf_from_coordinates

class TestDXFGeneration(unittest.TestCase):
    def setUp(self):
        self.lat = -22.324554
        self.lng = -41.753739
        self.radius = 100
        self.output_file = "test_unittest_utm.dxf"

    def tearDown(self):
        if os.path.exists(self.output_file):
            os.remove(self.output_file)

    def test_generate_dxf(self):
        result = generate_dxf_from_coordinates(
            lat=self.lat,
            lng=self.lng,
            radius=self.radius,
            output_filename=self.output_file
        )
        self.assertTrue(os.path.exists(self.output_file))
        self.assertEqual(result["filename"], self.output_file)
        self.assertIn("total_objects", result["stats"])
        # Verifica se não há 'nan' no arquivo
        with open(self.output_file, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            self.assertNotIn('nan', content)

if __name__ == "__main__":
    unittest.main()
