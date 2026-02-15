import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config'; // Load env vars

import { fileURLToPath } from 'url';
import path from 'path';
import Groq from 'groq-sdk';

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

// Test Python Bridge Route
app.get('/api/bridge-test', async (_req: Request, res: Response) => {
    try {
        console.log("Bridge Test: Executing python --version...");
        const { exec } = await import('child_process');

        exec('python --version', (error, stdout, stderr) => {
            if (error) {
                console.error("Bridge Test Error:", error);
                return res.status(500).json({ error: 'Bridge failed', details: error.message });
            }
            console.log("Bridge Test Success:", stdout || stderr);
            res.json({
                status: 'success',
                message: 'Node-Python Bridge is operational',
                pythonOutput: stdout || stderr
            });
        });
    } catch (err: any) {
        console.error("Bridge Test Exception:", err);
        res.status(500).json({ error: 'Bridge failed', details: err.message });
    }
});

// Health Check
app.get('/', (_req: Request, res: Response) => {
    res.json({
        status: 'online',
        service: 'sisRUA Unified Backend',
        version: '1.0.0'
    });
});

import { generateDxf } from './pythonBridge.js'; // Note .js extension for ESM

// Serve generated files
app.use('/downloads', express.static(path.join(__dirname, '../public/dxf')));

// DXF Generation Endpoint
app.get('/api/dxf', async (req: Request, res: Response) => {
    try {
        const { lat, lon, radius } = req.query;

        if (!lat || !lon || !radius) {
            return res.status(400).json({ error: 'Missing lat, lon, or radius' });
        }

        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(__dirname, '../public/dxf', filename);

        console.log(`[API] Generatig DXF for ${lat}, ${lon} radius=${radius}`);

        // Call Python Engine
        await generateDxf({
            lat: parseFloat(lat as string),
            lon: parseFloat(lon as string),
            radius: parseFloat(radius as string),
            mode: (req.query.mode as string) || 'circle',
            polygon: (req.query.polygon as string) || '[]',
            outputFile
        });

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

// AI Search Endpoint
app.post('/api/search', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        // Try to parse UTM coordinates first (format: "24K 0216330 7528658")
        const utmMatch = query.match(/(\d{1,2})[KkLlMm]\s+(\d{6,7})\s+(\d{7})/);

        if (utmMatch) {
            const zone = parseInt(utmMatch[1]);
            const easting = parseInt(utmMatch[2]);
            const northing = parseInt(utmMatch[3]);

            console.log(`Parsing UTM: Zone ${zone}K, Easting ${easting}, Northing ${northing}`);

            // Convert UTM to Lat/Lon using pyproj-style calculation
            // For Brazilian coordinates (zone 24K), hemisphere is 'S' (South)
            const hemisphere = 'S';
            const coords = utmToLatLon(zone, hemisphere, easting, northing);

            if (coords) {
                console.log(`UTM converted to: ${coords.lat}, ${coords.lng}`);
                return res.json({
                    lat: coords.lat,
                    lng: coords.lng,
                    label: `UTM ${zone}K ${easting} ${northing}`
                });
            }
        }

        // If not UTM, use AI for geocoding
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

        const groq = new Groq({ apiKey });

        const prompt = `
        You are a geocoding assistant. 
        Geocode the following place name to latitude/longitude coordinates.
        
        Return ONLY a JSON object with { "lat": number, "lng": number, "label": string } for the query: "${query}". 
        The label should be the formatted address.
        Do not include markdown formatting.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
        });

        let text = completion.choices[0]?.message?.content || "";
        console.log("AI Raw Response:", text);

        // Find JSON object using regex
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("AI failed to return valid JSON:", text);
            return res.status(500).json({ error: "AI failed to return valid JSON", raw: text });
        }

        const data = JSON.parse(jsonMatch[0]);
        res.json(data);
    } catch (error: any) {
        console.error("AI Search Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// UTM to Lat/Lon conversion function
function utmToLatLon(zone: number, hemisphere: 'N' | 'S', easting: number, northing: number): { lat: number, lng: number } | null {
    if (!zone || !easting || !northing) return null;

    const a = 6378137; // WGS84 semi-major axis
    const f = 1 / 298.257223563; // WGS84 flattening
    const k0 = 0.9996; // UTM scale factor
    const e = Math.sqrt(f * (2 - f));

    const x = easting - 500000;
    const y = hemisphere === 'S' ? northing - 10000000 : northing;

    const m = y / k0;
    const mu = m / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

    const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));

    const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const J3 = (151 * Math.pow(e1, 3) / 96);
    const J4 = (1097 * Math.pow(e1, 4) / 512);

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
    const c1 = e2 * Math.pow(Math.cos(fp), 2);
    const t1 = Math.pow(Math.tan(fp), 2);
    const r1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
    const n1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
    const d = x / (n1 * k0);

    const latRad = fp - (n1 * Math.tan(fp) / r1) * (Math.pow(d, 2) / 2 - (5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * e2) * Math.pow(d, 4) / 24 + (61 + 90 * t1 + 298 * c1 + 45 * Math.pow(t1, 2) - 252 * e2 - 3 * Math.pow(c1, 2)) * Math.pow(d, 6) / 720);
    const lngRad = (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6 + (5 - 2 * c1 + 28 * t1 - 3 * Math.pow(c1, 2) + 8 * e2 + 24 * Math.pow(t1, 2)) * Math.pow(d, 5) / 120) / Math.cos(fp);

    const zoneCentralMeridian = (zone - 1) * 6 - 180 + 3;
    const lng = (lngRad * 180 / Math.PI) + zoneCentralMeridian;
    const lat = latRad * 180 / Math.PI;

    return { lat, lng };
}

// AI Analyze Endpoint
app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
        const { stats, locationName } = req.body;
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

        const groq = new Groq({ apiKey });

        const hasData = stats.buildings > 0 || stats.roads > 0 || stats.trees > 0;

        const prompt = hasData ? `
        Você é um analista urbano. Analise os dados de ${locationName}:
        - Edificações: ${stats.buildings}
        - Vias: ${stats.roads}  
        - Vegetação: ${stats.trees}
        - Área Total: ${stats.totalArea} m²
        
        Forneça 3-4 pontos técnicos sobre densidade, infraestrutura e recomendações.
        RESPONDA EM PORTUGUÊS BRASILEIRO.
        Retorne JSON: { "analysis": "análise em markdown com bullets" }
        ` : `
        A região ${locationName} não tem dados no OSM.
        Explique em 3 pontos: (1) possíveis razões, (2) alternativas de dados, (3) como proceder.
        RESPONDA EM PORTUGUÊS BRASILEIRO.
        Retorne JSON: { "analysis": "explicação em markdown" }
        `;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
        });

        let text = completion.choices[0]?.message?.content || "";
        console.log("AI Analyze Raw Response:", text);

        // Find JSON object using regex
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("AI failed to return valid JSON for analysis:", text);
            return res.status(500).json({ error: "AI failed to return valid JSON for analysis", raw: text });
        }

        const data = JSON.parse(jsonMatch[0]);
        res.json(data);

    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Catch-all 404 for debugging
app.use((req, res) => {
    console.log(`[DEBUG] 404 on ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.originalUrl,
        availableRoutes: ['/', '/api/bridge-test', '/api/dxf', '/api/search', '/api/analyze']
    });
});

app.listen(port, () => {
    console.log(`
  🚀 sisRUA Unified running on http://localhost:${port}
  -----------------------------------------------
  🐍 Python Bridge Test: /api/bridge-test
  🏗️  DXF Generation:    /api/dxf?lat=...&lon=...&radius=...
  -----------------------------------------------
  `);
});
