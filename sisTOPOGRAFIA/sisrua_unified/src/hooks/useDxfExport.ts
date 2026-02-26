import { useEffect, useState } from 'react';
import { generateDXF, getDxfJobStatus } from '../services/dxfService';
import { SelectionMode, GeoLocation, LayerConfig } from '../types';

interface UseDxfExportProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function useDxfExport({ onSuccess, onError }: UseDxfExportProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState('idle');
  const [jobProgress, setJobProgress] = useState(0);
  const [downloadCenter, setDownloadCenter] = useState<GeoLocation | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const triggerDownload = (url: string | null, center: GeoLocation | null) => {
    if (!url || !center) return;
    const filename = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const confirmDownload = () => {
    triggerDownload(previewUrl, downloadCenter);
    clearPreview();
  };

  const clearPreview = () => {
    setPreviewUrl(null);
  };

  const downloadDxf = async (
    center: GeoLocation,
    radius: number,
    selectionMode: SelectionMode,
    polygon: GeoLocation[],
    layers: LayerConfig,
    projection: 'local' | 'utm' = 'utm'
  ) => {
    setIsDownloading(true);
    setJobStatus('queued');
    setJobProgress(0);
    setPreviewUrl(null);
    setDownloadCenter(center);

    try {
      const result = await generateDXF(
        center.lat,
        center.lng,
        radius,
        selectionMode,
        polygon,
        layers,
        projection
      );

      if (!result) {
        throw new Error('Backend failed to queue DXF generation');
      }

      if ('url' in result && result.url) {
        setPreviewUrl(result.url);
        onSuccess('DXF Gerado. Visualização Pronta.');
        setIsDownloading(false);
        setJobStatus('completed');
        setJobProgress(100);
        return true;
      }

      if ('jobId' in result && result.jobId) {
        setJobId(String(result.jobId));
        return true;
      }

      throw new Error('Backend failed to queue DXF generation');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DXF generation failed';
      setIsDownloading(false);
      setJobStatus('failed');
      onError(`DXF Error: ${message}`);
      return false;
    }
  };

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let isActive = true;
    const intervalId = window.setInterval(async () => {
      try {
        const statusResponse = await getDxfJobStatus(jobId);
        if (!isActive) {
          return;
        }

        setJobStatus(statusResponse.status);
        if (typeof statusResponse.progress === 'number') {
          setJobProgress(statusResponse.progress);
        }

        if (statusResponse.status === 'completed') {
          const url = statusResponse.result?.url;
          if (!url) {
            throw new Error('DXF job completed without a URL');
          }

          setPreviewUrl(url);
          onSuccess('DXF Gerado. Visualização Pronta.');
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobProgress(100);
          setJobStatus('completed');
          // Important: Keep downloadCenter for confirmed download
          return;
        }

        if (statusResponse.status === 'failed') {
          const errorMessage = statusResponse.error || 'DXF generation failed';
          onError(`DXF Error: ${errorMessage}`);
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobStatus('failed');
          setDownloadCenter(null);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message = error instanceof Error ? error.message : 'DXF generation failed';
        onError(`DXF Error: ${message}`);
        clearInterval(intervalId);
        setJobId(null);
        setIsDownloading(false);
        setJobStatus('failed');
        setDownloadCenter(null);
      }
    }, 2000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [jobId, onError, onSuccess]); // Removed downloadCenter from deps to avoid triggering effect

  return {
    downloadDxf,
    confirmDownload,
    clearPreview,
    previewUrl,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress
  };
}
