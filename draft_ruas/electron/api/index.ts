import express from 'express';
import cors from 'cors';
import dxfRoutes from './routes/dxf';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/dxf', dxfRoutes);

export function startServer() {
  app.listen(port, () => {
    console.log(`Modular Job Server running at http://localhost:${port}`);
  });
}
