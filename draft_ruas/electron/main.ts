import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { spawn } from 'child_process'
import * as fs from 'fs'
import AdmZip from 'adm-zip'
import { startServer } from './api'

process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.PUBLIC || '', 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    width: 1200,
    height: 800,
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

app.on('window-all-closed', () => {
  win = null
})

app.whenReady().then(() => {
  createWindow()
  startServer()
})

// IPC Handlers
ipcMain.handle('run-python-script', async (event, args) => {
  const { lat, lon, radius, output, layers, crs } = args;
  console.log("Request to run python script with args:", args);

  return new Promise((resolve, reject) => {
    // Determine python path (dev vs prod)
    // For dev, assume venv is at root
    const pythonPath = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
    // const pythonPath = 'python'; // Fallback if venv not found?
    const scriptPath = path.join(process.cwd(), 'py_engine', 'main.py');

    console.log(`Spawning: ${pythonPath} ${scriptPath}`);

    const pythonProcess = spawn(pythonPath, [
      scriptPath,
      '--lat', lat.toString(),
      '--lon', lon.toString(),
      '--radius', radius.toString(),
      '--output', output,
      '--layers', JSON.stringify(layers),
      '--crs', crs,
      '--format', args.format || 'dxf',
      '--selection_mode', args.selectionMode || 'circle',
      '--polygon', JSON.stringify(args.polygon || []),
      '--client_name', args.clientName || 'CLIENTE PADRÃO',
      '--project_id', args.projectId || 'PROJETO URBANISTICO'
    ]);

    pythonProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          console.log(`PY: ${line}`);
          try {
            // Try to parse as JSON for structured logs
            const jsonLog = JSON.parse(line.trim());
            event.sender.send('python-log', jsonLog);
          } catch (e) {
            // Fallback for raw text
            event.sender.send('python-log', { status: 'info', message: line.trim() });
          }
        }
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`PY ERR: ${data}`);
      event.sender.send('python-log', { status: 'error', message: data.toString() });
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Python process exited with code ${code}`));
      }
    });
  });
})

ipcMain.handle('parse-kml-file', async (event, filePath: string) => {
  try {
    let kmlContent = '';

    if (filePath.toLowerCase().endsWith('.kmz')) {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      const docEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith('.kml'));
      if (!docEntry) throw new Error("No KML file found inside KMZ.");
      kmlContent = docEntry.getData().toString('utf8');
    } else {
      kmlContent = fs.readFileSync(filePath, 'utf8');
    }

    // Extract coordinates using regex (works for simple <coordinates> blocks)
    // Format is usually: <coordinates>lon,lat,alt lon,lat,alt ...</coordinates>
    // Or just one point.
    const coordsMatches = kmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/gi);
    if (!coordsMatches) throw new Error("No coordinates found in file.");

    const allPoints: [number, number][] = [];
    coordsMatches.forEach(match => {
      const cleanText = match.replace(/<\/?coordinates>/gi, '').trim();
      const pointStrings = cleanText.split(/\s+/);

      pointStrings.forEach(ps => {
        const parts = ps.split(',');
        if (parts.length >= 2) {
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            allPoints.push([lat, lon]);
          }
        }
      });
    });

    if (allPoints.length === 0) throw new Error("Could not parse any points from the file.");

    return { success: true, points: allPoints };
  } catch (error: any) {
    console.error("KML Parse error:", error);
    return { success: false, error: error.message };
  }
});
