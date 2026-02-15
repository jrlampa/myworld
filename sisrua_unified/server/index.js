// Node.js + Express Smart Backend
const express = require('express');
const cors = require('cors');
const { generateDXF } = require('./services/dxfService');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper for AI
const analyzeStats = async (stats, locationName) => {
  if (!process.env.API_KEY) return "Analysis unavailable (No Server API Key).";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this OSM data summary for ${locationName}: ${JSON.stringify(stats)}. Provide a 2-sentence architectural or urban planning summary suitable for a CAD engineer.`,
    });
    return response.text;
  } catch (e) {
    console.error("AI Error", e);
    return "Analysis failed.";
  }
};

const searchLocation = async (query) => {
    if (!process.env.API_KEY) throw new Error("Server API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the precise latitude and longitude for the location described as: "${query}". Return JSON with lat, lng, and label.`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
};

// --- Routes ---

app.post('/api/dxf', (req, res) => {
  try {
    const { elements, center, terrain, options } = req.body;
    console.log(`Generating DXF for ${center.label}...`);
    const dxfString = generateDXF(elements, center, terrain, options);
    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename=export.dxf`);
    res.send(dxfString);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate DXF" });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { stats, locationName } = req.body;
    const analysis = await analyzeStats(stats, locationName);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: "Analysis failed" });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    const location = await searchLocation(query);
    res.json(location);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

app.listen(port, () => {
  console.log(`Smart Backend running on port ${port}`);
});