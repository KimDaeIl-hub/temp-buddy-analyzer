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
  sterilizationType: 'pasteurization' | 'sterilization',
  previousSessionEndFValue?: number
): { 
  averageTemp: number; 
  durationMinutes: number;
  maxFValue: number;
  sessionFValue: number;
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
      sessionFValue: 0,
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
  
  // Get F-values from records that have them
  const recordsWithFValue = records.filter(r => r.fValue !== undefined && r.fValue !== null);
  
  // Get max F-value in this session
  const maxFValue = recordsWithFValue.length > 0 
    ? Math.max(...recordsWithFValue.map(r => r.fValue!)) 
    : 0;
  
  // Get the F-value at the end of this session (last record with F-value)
  const endFValue = recordsWithFValue.length > 0 
    ? recordsWithFValue[recordsWithFValue.length - 1].fValue! 
    : 0;
  
  // Get the F-value at the start of this session (first record with F-value)
  const startFValue = recordsWithFValue.length > 0 
    ? recordsWithFValue[0].fValue! 
    : 0;
  
  // Calculate session F-value: difference between end and start F-value of this session
  // If previousSessionEndFValue is provided, subtract it from the start
  const sessionFValue = previousSessionEndFValue !== undefined
    ? endFValue - previousSessionEndFValue
    : endFValue - startFValue + (recordsWithFValue.length > 0 ? recordsWithFValue[0].fValue! : 0);
  
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
    sessionFValue: Math.max(0, endFValue - (previousSessionEndFValue || 0)),
    f63Minutes,
    f121Minutes,
    qualifyingRecords 
  };
}

export function getRecordsInSession(
  records: TemperatureRecord[],
  session: MeasurementSession
): TemperatureRecord[] {
  return records.filter(
    r => r.timestamp >= session.startTime && r.timestamp <= session.endTime
  );
}

// Get F-value at the end of a session for a logger
export function getSessionEndFValue(
  records: TemperatureRecord[],
  session: MeasurementSession
): number | undefined {
  const sessionRecords = getRecordsInSession(records, session);
  const recordsWithFValue = sessionRecords.filter(r => r.fValue !== undefined && r.fValue !== null);
  if (recordsWithFValue.length === 0) return undefined;
  return recordsWithFValue[recordsWithFValue.length - 1].fValue;
}

export function calculateSessionResults(
  logger: DataLogger,
  sessions: MeasurementSession[]
): CalculationResult[] {
  const results: CalculationResult[] = [];
  
  // Sort sessions by start time to calculate cumulative F-values correctly
  const sortedSessions = [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Track previous session's end F-value for each logger
  let previousEndFValue: number | undefined = undefined;
  
  sortedSessions.forEach((session) => {
    const sessionRecords = getRecordsInSession(logger.records, session);
    
    if (sessionRecords.length === 0) return;
    
    if (logger.type === 'hotwater') {
      // Use session's setTemperature if available, otherwise use logger's setTemperature
      const setTemperature = session.setTemperature || logger.setTemperature;
      
      if (!setTemperature) return;
      
      const { averageTemp, durationMinutes } = calculateHotWaterResults(
        sessionRecords,
        setTemperature
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
        threshold: setTemperature - 2.4,
      });
    } else if (logger.type === 'product') {
      const sterilizationType = logger.sterilizationType || 'pasteurization';
      
      const { averageTemp, durationMinutes, maxFValue, sessionFValue, f63Minutes, f121Minutes } = 
        calculateProductResults(sessionRecords, sterilizationType, previousEndFValue);
      
      // Update previousEndFValue for next session
      const currentEndFValue = getSessionEndFValue(logger.records, session);
      if (currentEndFValue !== undefined) {
        previousEndFValue = currentEndFValue;
      }
      
      results.push({
        loggerId: logger.id,
        loggerName: logger.name,
        loggerType: logger.type,
        sessionId: session.id,
        sessionName: session.name,
        averageTemp,
        durationMinutes,
        maxFValue,
        sessionFValue,
        f63Minutes,
        f121Minutes,
        recordCount: sessionRecords.length,
        threshold: 63,
        sterilizationType,
      });
    }
  });
  
  return results;
}
