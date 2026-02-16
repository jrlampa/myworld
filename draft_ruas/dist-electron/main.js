"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
process.env.DIST = path.join(__dirname, "../dist");
process.env.PUBLIC = electron.app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  win = new electron.BrowserWindow({
    icon: path.join(process.env.PUBLIC || "", "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    },
    width: 1200,
    height: 800
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || "", "index.html"));
  }
}
electron.app.on("window-all-closed", () => {
  win = null;
});
electron.app.whenReady().then(createWindow);
electron.ipcMain.handle("run-python-script", async (event, args) => {
  const { lat, lon, radius, output, layers, crs } = args;
  console.log("Request to run python script with args:", args);
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(process.cwd(), "venv", "Scripts", "python.exe");
    const scriptPath = path.join(process.cwd(), "py_engine", "main.py");
    console.log(`Spawning: ${pythonPath} ${scriptPath}`);
    const pythonProcess = child_process.spawn(pythonPath, [
      scriptPath,
      "--lat",
      lat.toString(),
      "--lon",
      lon.toString(),
      "--radius",
      radius.toString(),
      "--output",
      output,
      "--layers",
      JSON.stringify(layers),
      "--crs",
      crs
    ]);
    pythonProcess.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          console.log(`PY: ${line}`);
          try {
            const jsonLog = JSON.parse(line.trim());
            event.sender.send("python-log", jsonLog);
          } catch (e) {
            event.sender.send("python-log", { status: "info", message: line.trim() });
          }
        }
      });
    });
    pythonProcess.stderr.on("data", (data) => {
      console.error(`PY ERR: ${data}`);
      event.sender.send("python-log", { status: "error", message: data.toString() });
    });
    pythonProcess.on("close", (code) => {
      console.log(`Python process exited with code ${code}`);
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Python process exited with code ${code}`));
      }
    });
  });
});
