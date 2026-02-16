import pytest
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from elevation_client import fetch_elevation_grid

class TestElevation:
    @patch('requests.post')
    def test_fetch_elevation_grid_success(self, mock_post):
        # Mock response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'results': [
                {'latitude': 10.0, 'longitude': 10.0, 'elevation': 100.0},
                {'latitude': 10.0, 'longitude': 10.1, 'elevation': 105.0}
            ]
        }
        mock_post.return_value = mock_resp
        
        # Call - function returns (elevations, rows, cols)
        elevations, rows, cols = fetch_elevation_grid(10.1, 10.0, 10.2, 10.0, resolution=10000) # Big resolution for few points
        
        assert len(elevations) > 0
        assert elevations[0][2] == 100.0

    @patch('requests.post')
    def test_fetch_elevation_grid_failure(self, mock_post):
        # Mock failure
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_post.return_value = mock_resp
        
        # Call - function returns (elevations, rows, cols)
        elevations, rows, cols = fetch_elevation_grid(10.1, 10.0, 10.2, 10.0, resolution=10000)
        
        # Should return 0 elevation on failure
        assert len(elevations) > 0
        assert elevations[0][2] == 0

