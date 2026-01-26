import { DataLogger, MeasurementSession } from "./temperature";

export interface AnalysisGroup {
  id: string;
  name: string;
  items: AnalysisGroupItem[];
  createdAt: Date;
}

export interface AnalysisGroupItem {
  loggerId: string;
  loggerName: string;
  loggerType: 'hotwater' | 'product' | null;
  sessionId: number;
  sessionName: string;
  sterilizationType?: 'pasteurization' | 'sterilization';
}

export interface AnalysisGroupResult {
  groupId: string;
  groupName: string;
  items: AnalysisGroupItem[];
  totalRecords: number;
  averageTemp: number;
  minTemp: number;
  maxTemp: number;
  totalDurationMinutes: number;
  totalFValue: number;
  itemResults: {
    loggerId: string;
    loggerName: string;
    sessionId: number;
    sessionName: string;
    averageTemp: number;
    durationMinutes: number;
    fValue: number;
    recordCount: number;
  }[];
}
