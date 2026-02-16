import { ChildProcess } from 'child_process';

export type JobStatus = 'pending' | 'running' | 'completed' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  logs: string[];
  outputFile?: string;
  process?: ChildProcess;
  createdAt: number;
  updatedAt: number;
}

export interface OsmEngineParams {
  lat: number;
  lon: number;
  radius: number;
  output: string;
  layers: any;
  crs: string;
  format?: string;
  selectionMode?: 'circle' | 'polygon';
  polygon?: [number, number][];
  clientName?: string;
  projectId?: string;
}

export interface ProgressPayload {
  status: JobStatus;
  progress: number;
  message: string;
}
