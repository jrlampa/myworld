import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

import { fileURLToPath } from 'url';
import path from 'path';
import { GeocodingService } from './services/geocodingService.js';
import { ElevationService } from './services/elevationService.js';
import { AnalysisService } from './services/analysisService.js';
import { generateDxf } from './pythonBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 3001;

// Configuração
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Logging Middleware
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health Check
app.get('/', (_req: Request, res: Response) => {
    res.json({
        status: 'online',
        service: 'sisRUA Unified Backend',
        version: '1.2.0'
    });
});

// Serve generated files
app.use('/downloads', express.static(path.join(__dirname, '../public/dxf')));

// DXF Generation Endpoint (POST for large polygons)
app.post('/api/dxf', async (req: Request, res: Response) => {
    try {
        const { lat, lon, radius, mode, polygon, layers, projection } = req.body;

        if (!lat || !lon || !radius) {
            return res.status(400).json({ error: 'Missing lat, lon, or radius in body' });
        }

        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(__dirname, '../public/dxf', filename);

        console.log(`[API] Generating DXF (POST) for ${lat}, ${lon} radius=${radius} mode=${mode} projection=${projection || 'local'}`);

        const generationPromise = generateDxf({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            radius: parseFloat(radius),
            mode: mode || 'circle',
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            outputFile
        });

        // 60s Timeout
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DXF Generation Timeout (60s)')), 60000)
        );

        await Promise.race([generationPromise, timeout]);

        const downloadUrl = `http://localhost:${port}/downloads/${filename}`;
        res.json({
            status: 'success',
            message: 'DXF Generated',
            url: downloadUrl
        });

    } catch (err: any) {
        console.error("DXF Generation Error:", err);
        res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

// Coordinate Search Endpoint (Using GeocodingService)
app.post('/api/search', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const location = await GeocodingService.resolveLocation(query);

        if (location) {
            res.json(location);
        } else {
            res.status(404).json({ error: 'Location not found' });
        }
    } catch (error: any) {
        console.error("Search Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Elevation Profile Endpoint (Delegating to ElevationService)
app.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        const { start, end, steps = 25 } = req.body;
        if (!start || !end) return res.status(400).json({ error: 'Start and end coordinates required' });

        const profile = await ElevationService.getElevationProfile(start, end, steps);
        res.json({ profile });
    } catch (error: any) {
        console.error("Elevation Profile Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint (Delegating to AnalysisService)
app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
        const { stats, locationName } = req.body;
        const apiKey = process.env.GROQ_API_KEY || '';
        if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

        const result = await AnalysisService.analyzeArea(stats, locationName, apiKey);
        res.json(result);
    } catch (error: any) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 sisRUA Backend v1.2.0 operational on http://localhost:${port}`);
});
