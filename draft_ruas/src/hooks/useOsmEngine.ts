import { useState, useEffect } from 'react';

interface LogMessage {
  status: string;
  message: string;
}

interface OsmEngineParams {
  lat: number;
  lon: number;
  radius: number;
  outputName: string;
  layers: any;
  crs: string;
  exportFormat?: string;
  selectionMode?: 'circle' | 'polygon';
  polygon?: [number, number][];
  clientName?: string;
  projectId?: string;
}

export function useOsmEngine() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [geojsonData, setGeojsonData] = useState<any>(null);

  useEffect(() => {
    // Listen for logs from main process
    try {
      // @ts-ignore
      const removeListener = window.ipcRenderer.on('python-log', (event: any, log: any) => {
        if (log.type === 'geojson') {
          setGeojsonData(log.data);
        } else {
          setLogs(prev => [...prev, log]);
        }
      });
      return () => removeListener();
    } catch (e) {
      console.warn("IPC Not available (Dev mode in browser?)");
    }
  }, []);

  const generateDxf = async (params: OsmEngineParams) => {
    setIsGenerating(true);
    setLogs([]);
    setGeojsonData(null);

    try {
      // 1. Start Job
      const startResp = await fetch('http://localhost:3001/api/dxf/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const { jobId } = await startResp.json();

      // 2. Connect to SSE for progress
      const eventSource = new EventSource(`http://localhost:3001/api/dxf/progress/${jobId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.status === 'completed') {
          setLogs(prev => [...prev, { status: 'success', message: 'Generation complete!' }]);
          setIsGenerating(false);
          eventSource.close();
        } else if (data.status === 'error') {
          setLogs(prev => [...prev, { status: 'error', message: data.message }]);
          setIsGenerating(false);
          eventSource.close();
        } else {
          // Progress update
          setLogs(prev => {
            // Keep only last N logs to avoid UI lag
            const newLogs = [...prev, { status: 'info', message: `[${data.progress || 0}%] ${data.message}` }];
            return newLogs.slice(-50);
          });
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE Error:", err);
        eventSource.close();
        setIsGenerating(false);
      };

    } catch (error) {
      console.error("Error starting DXF job:", error);
      setLogs(prev => [...prev, { status: 'error', message: String(error) }]);
      setIsGenerating(false);
    }
  };

  const addLog = (log: LogMessage) => {
    setLogs(prev => [...prev, log]);
  };

  return {
    isGenerating,
    logs,
    geojsonData,
    generateDxf,
    addLog
  };
}
