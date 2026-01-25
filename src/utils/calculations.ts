import { DataLogger, MeasurementSession, CalculationResult, TemperatureRecord } from "@/types/temperature";

export function calculateHotWaterResults(
  records: TemperatureRecord[],
  setTemperature: number
): { averageTemp: number; durationMinutes: number; qualifyingRecords: TemperatureRecord[] } {
  const threshold = setTemperature - 2.4;
  const qualifyingRecords = records.filter(r => r.temperature >= threshold);
  
  if (qualifyingRecords.length === 0) {
    return { averageTemp: 0, durationMinutes: 0, qualifyingRecords: [] };
  }
  
  const averageTemp = qualifyingRecords.reduce((sum, r) => sum + r.temperature, 0) / qualifyingRecords.length;
  
  // Calculate duration based on time difference
  let durationMinutes = 0;
  if (qualifyingRecords.length > 1) {
    const firstTime = qualifyingRecords[0].timestamp.getTime();
    const lastTime = qualifyingRecords[qualifyingRecords.length - 1].timestamp.getTime();
    durationMinutes = (lastTime - firstTime) / (1000 * 60);
  } else if (qualifyingRecords.length === 1) {
    // Assume 5-second interval for single record
    durationMinutes = 5 / 60;
  }
  
  return { averageTemp, durationMinutes, qualifyingRecords };
}

export function calculateProductResults(
  records: TemperatureRecord[],
  sterilizationType: 'pasteurization' | 'sterilization'
): { 
  averageTemp: number; 
  durationMinutes: number;
  maxFValue: number;
  f63Minutes: number;
  f121Minutes: number;
  qualifyingRecords: TemperatureRecord[];
} {
  const threshold = 63;
  const qualifyingRecords = records.filter(r => r.temperature >= threshold);
  
  if (qualifyingRecords.length === 0) {
    return { 
      averageTemp: 0, 
      durationMinutes: 0, 
      maxFValue: 0,
      f63Minutes: 0,
      f121Minutes: 0,
      qualifyingRecords: [] 
    };
  }
  
  const averageTemp = qualifyingRecords.reduce((sum, r) => sum + r.temperature, 0) / qualifyingRecords.length;
  
  // Calculate duration
  let durationMinutes = 0;
  if (qualifyingRecords.length > 1) {
    const firstTime = qualifyingRecords[0].timestamp.getTime();
    const lastTime = qualifyingRecords[qualifyingRecords.length - 1].timestamp.getTime();
    durationMinutes = (lastTime - firstTime) / (1000 * 60);
  }
  
  // Get max F-value from records
  const maxFValue = Math.max(...records.map(r => r.fValue || 0));
  
  // Calculate F63 and F121 based on temperature thresholds
  const f63Records = records.filter(r => r.temperature >= 63);
  const f121Records = records.filter(r => r.temperature >= 121);
  
  let f63Minutes = 0;
  if (f63Records.length > 1) {
    const firstTime = f63Records[0].timestamp.getTime();
    const lastTime = f63Records[f63Records.length - 1].timestamp.getTime();
    f63Minutes = (lastTime - firstTime) / (1000 * 60);
  }
  
  let f121Minutes = 0;
  if (f121Records.length > 1) {
    const firstTime = f121Records[0].timestamp.getTime();
    const lastTime = f121Records[f121Records.length - 1].timestamp.getTime();
    f121Minutes = (lastTime - firstTime) / (1000 * 60);
  }
  
  return { 
    averageTemp, 
    durationMinutes, 
    maxFValue,
    f63Minutes,
    f121Minutes,
    qualifyingRecords 
  };
}

export function calculateSessionResults(
  logger: DataLogger,
  sessions: MeasurementSession[]
): CalculationResult[] {
  const results: CalculationResult[] = [];
  
  sessions.forEach((session) => {
    const sessionRecords = logger.records.filter(
      r => r.index >= session.startIndex && r.index <= session.endIndex
    );
    
    if (sessionRecords.length === 0) return;
    
    if (logger.type === 'hotwater' && logger.setTemperature) {
      const { averageTemp, durationMinutes } = calculateHotWaterResults(
        sessionRecords,
        logger.setTemperature
      );
      
      results.push({
        loggerId: logger.id,
        loggerName: logger.name,
        loggerType: logger.type,
        sessionId: session.id,
        sessionName: session.name,
        averageTemp,
        durationMinutes,
        maxFValue: 0,
        recordCount: sessionRecords.length,
        threshold: logger.setTemperature - 2.4,
      });
    } else if (logger.type === 'product') {
      const { averageTemp, durationMinutes, maxFValue, f63Minutes, f121Minutes } = 
        calculateProductResults(sessionRecords, logger.sterilizationType || 'pasteurization');
      
      results.push({
        loggerId: logger.id,
        loggerName: logger.name,
        loggerType: logger.type,
        sessionId: session.id,
        sessionName: session.name,
        averageTemp,
        durationMinutes,
        maxFValue,
        f63Minutes,
        f121Minutes,
        recordCount: sessionRecords.length,
        threshold: 63,
      });
    }
  });
  
  return results;
}

export function getRecordsBySession(
  records: TemperatureRecord[],
  sessions: MeasurementSession[]
): Map<number, TemperatureRecord[]> {
  const sessionMap = new Map<number, TemperatureRecord[]>();
  
  sessions.forEach(session => {
    const sessionRecords = records.filter(
      r => r.index >= session.startIndex && r.index <= session.endIndex
    );
    sessionMap.set(session.id, sessionRecords);
  });
  
  return sessionMap;
}
