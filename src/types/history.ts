import { MeasurementSession } from "./temperature";

export interface SessionHistory {
  id: string;
  fileName: string;
  fileContent: string; // Base64 encoded file content for re-parsing
  sessions: MeasurementSession[];
  loggerConfigs: LoggerHistoryConfig[];
  savedAt: Date;
}

export interface LoggerHistoryConfig {
  loggerId: string;
  loggerName: string;
  type: 'hotwater' | 'product' | null;
  setTemperature?: number;
  sterilizationType?: 'pasteurization' | 'sterilization';
  // Per-session temperature settings for this logger
  sessionTemperatures?: Record<number, number>; // sessionId -> temperature
}
