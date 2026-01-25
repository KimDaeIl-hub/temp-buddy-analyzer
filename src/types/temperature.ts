export interface TemperatureRecord {
  date: string;
  time: string;
  temperature: number;
  fValue?: number;
  timestamp: Date;
  index: number;
}

export interface DataLogger {
  id: string;
  name: string;
  type: 'hotwater' | 'product' | null;
  records: TemperatureRecord[];
  setTemperature?: number;
  sterilizationType?: 'pasteurization' | 'sterilization';
}

export interface MeasurementSession {
  id: number;
  name: string;
  startIndex: number;
  endIndex: number;
  startTime: string;
  endTime: string;
}

export interface CalculationResult {
  loggerId: string;
  loggerName: string;
  loggerType: 'hotwater' | 'product' | null;
  sessionId: number;
  sessionName: string;
  averageTemp: number;
  durationMinutes: number;
  maxFValue: number;
  f63Minutes?: number;
  f121Minutes?: number;
  recordCount: number;
  threshold?: number;
}
