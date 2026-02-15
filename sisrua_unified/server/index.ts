import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

import { fileURLToPath } from 'url';
import path from 'path';
import Groq from 'groq-sdk';
import { GeocodingService } from './services/geocodingService.js';
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
        const { lat, lon, radius, mode, polygon, layers } = req.body;

        if (!lat || !lon || !radius) {
            return res.status(400).json({ error: 'Missing lat, lon, or radius in body' });
        }

        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(__dirname, '../public/dxf', filename);

        console.log(`[API] Generating DXF (POST) for ${lat}, ${lon} radius=${radius} mode=${mode}`);

        // Set a timeout for the python process
        const generationPromise = generateDxf({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            radius: parseFloat(radius),
            mode: mode || 'circle',
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            outputFile
        });

        // Timeout race
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

// AI Search Endpoint (Using GeocodingService)
app.post('/api/search', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const apiKey = process.env.GROQ_API_KEY || '';
        const location = await GeocodingService.resolveLocation(query, apiKey);

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

// Elevation Profile Endpoint (Smart Backend)
app.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        const { start, end, steps = 25 } = req.body;
        if (!start || !end) return res.status(400).json({ error: 'Start and and coordinates required' });

        const points = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            points.push({
                latitude: start.lat + (end.lat - start.lat) * t,
                longitude: start.lng + (end.lng - start.lng) * t
            });
        }

        const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locations: points })
        });

        if (!response.ok) throw new Error("Elevation API failed");
        const data = await response.json();

        // Calculate total distance (Haversine)
        const R = 6371e3;
        const φ1 = start.lat * Math.PI / 180;
        const φ2 = end.lat * Math.PI / 180;
        const Δφ = (end.lat - start.lat) * Math.PI / 180;
        const Δλ = (end.lng - start.lng) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const totalDist = R * c;

        const profile = data.results.map((r: any, i: number) => ({
            dist: parseFloat(((totalDist * i) / steps).toFixed(1)),
            elev: r.elevation
        }));

        res.json({ profile });
    } catch (error: any) {
        console.error("Elevation Profile Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint
app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
        const { stats, locationName } = req.body;
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

        const groq = new Groq({ apiKey });
        const hasData = stats.buildings > 0 || stats.roads > 0 || stats.trees > 0;

        const prompt = hasData ?
            `Analise urbana profissional em Português BR para ${locationName}: ${JSON.stringify(stats)}. Sugira melhorias. JSON: { "analysis": "markdown" }` :
            `Explique falta de dados em ${locationName}. JSON: { "analysis": "markdown" }`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.2
        });

        const text = completion.choices[0]?.message?.content || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        res.json(jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: "Erro na análise AI." });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 sisRUA Backend v1.2.0 operational on http://localhost:${port}`);
});
