
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dxfRoutes from './routes/dxfRoutes';
import aiRoutes from './routes/aiRoutes';

const app: Express = express();
const port = process.env.PORT || 3000;

// Configuração
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for heavy OSM Data

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rotas
app.use('/api', dxfRoutes);
app.use('/api', aiRoutes);

// Health Check
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'online', 
    service: 'OSM to DXF Smart Backend',
    version: '2.2.0' 
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(port, () => {
  console.log(`
  🚀 Smart Backend rodando em http://localhost:${port}
  -----------------------------------------------
  📡 Rotas de DXF:  /api/dxf/*
  🧠 Rotas de IA:   /api/analyze, /api/search
  -----------------------------------------------
  `);
});
