import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, DownloadCloud, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getDxfJobStatus } from '../services/dxfService';
import { API_BASE_URL } from '../config/api';

type BatchResult = {
  name: string;
  status: 'queued' | 'cached' | 'completed' | 'failed';
  jobId?: string | number;
  url?: string;
  error?: string;
  progress?: number;
};

type BatchError = {
  line: number;
  message: string;
  row?: Record<string, string | undefined>;
};

type BatchResponse = {
  results: BatchResult[];
  errors?: BatchError[];
};

type BatchUploadProps = {
  onError: (message: string) => void;
  onInfo: (message: string) => void;
};

const API_URL = API_BASE_URL;

const sanitizeFileName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_').slice(0, 40) || 'batch';

const triggerDownload = (url: string, name: string) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sanitizeFileName(name)}.dxf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const BatchUpload: React.FC<BatchUploadProps> = ({ onError, onInfo }) => {
  const [items, setItems] = useState<BatchResult[]>([]);
  const [errors, setErrors] = useState<BatchError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const pendingJobs = useMemo(
    () => items.filter((item) => item.status === 'queued' && item.jobId),
    [items]
  );

  const allCompleted = items.length > 0 && items.every((item) =>
    (item.status === 'completed' || item.status === 'cached') && !!item.url
  );

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/batch/dxf`, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Batch upload failed');
      }

      const batchResponse = payload as BatchResponse;
      setItems(batchResponse.results || []);
      setErrors(batchResponse.errors || []);
      if (batchResponse.errors && batchResponse.errors.length > 0) {
        onError(`CSV errors: ${batchResponse.errors.length} row(s) failed`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch upload failed';
      setErrors([{ line: 0, message }]);
      onError(message);
      setItems([]);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (pendingJobs.length === 0) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const currentPending = itemsRef.current.filter((item) => item.status === 'queued' && item.jobId);
      if (currentPending.length === 0) {
        return;
      }

      const updates = await Promise.all(currentPending.map(async (item) => {
        try {
          const status = await getDxfJobStatus(String(item.jobId));
          if (status.status === 'completed') {
            return {
              jobId: item.jobId,
              status: 'completed' as const,
              url: status.result?.url,
              progress: 100
            };
          }

          if (status.status === 'failed') {
            onError(`Batch DXF failed: ${item.name}`);
            return {
              jobId: item.jobId,
              status: 'failed' as const,
              error: status.error || 'DXF generation failed'
            };
          }

          return {
            jobId: item.jobId,
            status: 'queued' as const,
            progress: typeof status.progress === 'number' ? status.progress : item.progress
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'DXF generation failed';
          onError(`Batch DXF failed: ${item.name}`);
          return {
            jobId: item.jobId,
            status: 'failed' as const,
            error: message
          };
        }
      }));

      setItems((prev) => prev.map((item) => {
        const update = updates.find((entry) => entry.jobId === item.jobId);
        if (!update) {
          return item;
        }

        return {
          ...item,
          status: update.status,
          url: update.url || item.url,
          error: update.error || item.error,
          progress: update.progress ?? item.progress
        };
      }));
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [pendingJobs.length]);

  useEffect(() => {
    if (allCompleted) {
      onInfo('Batch DXF complete. Ready to download.');
    }
  }, [allCompleted, onInfo]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-800 p-2 text-emerald-400">
          <Upload size={18} />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">Batch DXF</span>
          <span className="text-sm font-semibold text-slate-100">Upload CSV and queue exports</span>
        </div>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-xs font-semibold uppercase tracking-widest transition ${isDragging ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <span className="flex items-center gap-2 text-emerald-300">
            <Loader2 size={16} className="animate-spin" />
            Uploading CSV...
          </span>
        ) : (
          <span>Drop CSV here or click to browse</span>
        )}
        <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
      </label>

      {errors.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          <div className="mb-2 flex items-center gap-2 text-rose-300">
            <AlertTriangle size={14} />
            <span className="font-semibold">CSV errors</span>
          </div>
          <ul className="space-y-1">
            {errors.map((err, index) => (
              <li key={`${err.line}-${index}`}>Line {err.line || '-'}: {err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={`${item.name}-${item.jobId ?? 'cached'}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
              <div className="flex flex-col">
                <span className="font-semibold">{item.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{item.status}</span>
              </div>
              <div className="flex items-center gap-2">
                {(item.status === 'completed' || item.status === 'cached') && item.url && (
                  <button
                    onClick={() => triggerDownload(item.url as string, item.name)}
                    className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200"
                  >
                    Download
                  </button>
                )}
                {item.status === 'queued' && (
                  <span className="text-[10px] text-slate-400">{item.progress ?? 0}%</span>
                )}
                {item.status === 'failed' && (
                  <span className="text-[10px] text-rose-300">{item.error || 'Failed'}</span>
                )}
                {(item.status === 'completed' || item.status === 'cached') && (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {allCompleted && (
        <button
          onClick={() => items.forEach((item) => item.url && triggerDownload(item.url, item.name))}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20"
        >
          <DownloadCloud size={16} />
          Download All
        </button>
      )}
    </div>
  );
};

export default BatchUpload;
