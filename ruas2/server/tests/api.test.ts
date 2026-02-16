import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { describe, it, expect, vi, Mock } from 'vitest';
import { generateDXF } from '../services/dxfService';

// Mock the services to avoid external calls or complex logic during API testing
vi.mock('../services/dxfService');
vi.mock('../services/geojsonService', () => ({
  generateGeoJSON: vi.fn().mockReturnValue('{"type": "FeatureCollection"}')
}));

// Setup Express App for testing
const app = express();
app.use(cors());
app.use(express.json());

// Re-implement the routes locally for testing to ensure we test the Express configuration
// In a real repo, we would export `app` from index.js, but here we simulate it
app.post('/api/dxf', (req, res) => {
  try {
    const { elements, center, terrain, options } = req.body;
    // @ts-ignore
    const dxfString = generateDXF(elements, center, terrain, options);
    res.setHeader('Content-Type', 'application/dxf');
    res.send(dxfString);
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

describe('API Endpoints', () => {
  
  describe('POST /api/dxf', () => {
    it('should return 200 and correct content type', async () => {
      (generateDXF as Mock).mockReturnValue('MOCKED DXF CONTENT');

      const res = await request(app)
        .post('/api/dxf')
        .send({
          elements: [],
          center: { lat: 0, lng: 0 },
          options: { simplificationLevel: 'low', layers: {} }
        });

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/dxf');
      expect(res.text).toBe('MOCKED DXF CONTENT');
    });

    it('should handle errors gracefully', async () => {
      (generateDXF as Mock).mockImplementation(() => { throw new Error('Fail'); });

      const res = await request(app)
        .post('/api/dxf')
        .send({});

      expect(res.status).toBe(500);
    });
  });
});