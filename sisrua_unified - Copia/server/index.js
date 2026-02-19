const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const topographyRoutes = require('./routes/topography');
app.use('/api/topography', topographyRoutes);

// Root redirect or health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'sisrua-unified-server' }));

app.listen(PORT, () => {
  console.log(`[SISRUA] Server running on http://localhost:${PORT}`);
  console.log(`[SISRUA] Mode: Architectural Hardening (Phase 12)`);
});