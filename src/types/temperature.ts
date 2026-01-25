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
  color?: string;
}

export interface MeasurementSession {
  id: number;
  name: string;
  startTime: Date;
  endTime: Date;
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
