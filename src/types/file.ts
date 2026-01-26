import { DataLogger, MeasurementSession } from "./temperature";

export interface DataFile {
  id: string;
  name: string;
  loggers: DataLogger[];
  sessions: MeasurementSession[];
  uploadedAt: Date;
}

export interface FileViewMode {
  mode: 'combined' | 'individual';
  selectedFileId?: string; // When individual mode, which file to show
}

export interface ResultFilter {
  fileId: string;
  loggerId: string;
  sessionId: number;
  enabled: boolean;
}
