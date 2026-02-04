import { DataLogger, MeasurementSession, CalculationResult, TemperatureRecord } from "@/types/temperature";

function getMeasurementIntervalSeconds(records: TemperatureRecord[]): number {
  // Derive interval from data (median delta). Falls back to 5 seconds.
  if (records.length < 2) return 5;
  const deltas: number[] = [];
  for (let i = 1; i < records.length; i++) {
    const delta = (records[i].timestamp.getTime() - records[i - 1].timestamp.getTime()) / 1000;
    if (Number.isFinite(delta) && delta > 0) deltas.push(delta);
  }
  if (deltas.length === 0) return 5;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  const median = deltas.length % 2 === 0 ? (deltas[mid - 1] + deltas[mid]) / 2 : deltas[mid];
  // Most loggers are 5s/10s; round to nearest 0.5s to avoid jitter.
  const rounded = Math.round(median * 2) / 2;
  return rounded > 0 ? rounded : 5;
}

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
  
  // Calculate duration: qualifying record count × measurement interval (derived from data)
  // Then convert to minutes and round to 1 decimal place
  const intervalSeconds = getMeasurementIntervalSeconds(records);
  const durationSeconds = qualifyingRecords.length * intervalSeconds;
  const durationMinutes = Math.round((durationSeconds / 60) * 10) / 10;
  
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
  
  // Calculate duration: qualifying record count × measurement interval (derived from data)
  // Then convert to minutes and round to 1 decimal place
  const intervalSeconds = getMeasurementIntervalSeconds(records);
  const durationSeconds = qualifyingRecords.length * intervalSeconds;
  const durationMinutes = Math.round((durationSeconds / 60) * 10) / 10;
  
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
  // Duration = record count × measurement interval (5 seconds), rounded to 1 decimal
  const f63Records = records.filter(r => r.temperature >= 63);
  const f121Records = records.filter(r => r.temperature >= 121);
  
  const f63Minutes = Math.round((f63Records.length * intervalSeconds / 60) * 10) / 10;
  const f121Minutes = Math.round((f121Records.length * intervalSeconds / 60) * 10) / 10;
  
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
      // Get logger-specific temperature from loggerSetTemperatures, or fallback to session/logger level
      let setTemperature: number | undefined;
      
      // First try logger-specific temperature
      if (session.loggerSetTemperatures && session.loggerSetTemperatures[logger.id] !== undefined) {
        setTemperature = session.loggerSetTemperatures[logger.id];
      } else {
        // Fallback to legacy setTemperature
        setTemperature = session.setTemperature || logger.setTemperature;
      }
      
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
