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
  setTemperature?: number; // 기본 열수 설정 온도 (deprecated - use loggerSetTemperatures)
  loggerSetTemperatures?: Record<string, number>; // 로거별 열수 설정 온도
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
  sessionFValue?: number; // 회차별 F value (누적 아닌 순수 회차 값)
  f63Minutes?: number;
  f121Minutes?: number;
  recordCount: number;
  threshold?: number;
  sterilizationType?: 'pasteurization' | 'sterilization';
}
