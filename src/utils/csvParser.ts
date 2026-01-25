import { DataLogger, TemperatureRecord } from "@/types/temperature";

export function parseCSVContent(content: string): DataLogger[] {
  const loggers: DataLogger[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return loggers;
  
  // Parse header to find logger columns
  const headerLine = lines[0];
  const headers = headerLine.split(';');
  
  // Find all temperature columns (pattern: pv######(File #) # - Temperature)
  const loggerColumns: { index: number; name: string }[] = [];
  
  headers.forEach((header, index) => {
    // Match patterns like "pv144556(File 1) 1- Temperature" or similar
    const match = header.match(/pv\d+\(File\s*\d+\)\s*\d+\s*[-–]\s*Temperature/i);
    if (match) {
      loggerColumns.push({ index, name: header.replace(/[^\x20-\x7E]/g, '').trim() });
    }
    // Also check for standalone temperature columns
    if (header.toLowerCase().includes('temperature') && !loggerColumns.some(l => l.index === index)) {
      const cleanName = header.replace(/[^\x20-\x7E]/g, '').trim();
      if (cleanName) {
        loggerColumns.push({ index, name: cleanName });
      }
    }
  });

  // If no specific logger columns found, assume single logger with columns: date, time, temp, [fvalue]
  if (loggerColumns.length === 0) {
    loggerColumns.push({ index: 2, name: 'Logger 1' });
  }

  // Initialize loggers
  loggerColumns.forEach((col, idx) => {
    loggers.push({
      id: `logger-${idx + 1}`,
      name: col.name || `Logger ${idx + 1}`,
      type: null,
      records: [],
    });
  });

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = line.split(';');
    if (values.length < 3) continue;

    const dateStr = values[0]?.trim();
    const timeStr = values[1]?.trim();
    
    if (!dateStr || !timeStr) continue;

    // Parse date (format: DD/MM/YYYY)
    const dateParts = dateStr.split('/');
    let timestamp: Date;
    
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      
      // Parse time (format: HH:MM:SS.mmm)
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0] || '0', 10);
      const minutes = parseInt(timeParts[1] || '0', 10);
      const seconds = parseFloat(timeParts[2] || '0');
      
      timestamp = new Date(year, month, day, hours, minutes, Math.floor(seconds));
    } else {
      continue;
    }

    // Process each logger column
    loggerColumns.forEach((col, loggerIdx) => {
      const tempStr = values[col.index]?.trim().replace(',', '.');
      const temperature = parseFloat(tempStr);
      
      if (!isNaN(temperature)) {
        // Check if there's an F-value column (usually next column)
        let fValue: number | undefined;
        const fValueStr = values[col.index + 1]?.trim().replace(',', '.');
        if (fValueStr && !isNaN(parseFloat(fValueStr))) {
          fValue = parseFloat(fValueStr);
        }
        
        loggers[loggerIdx].records.push({
          date: dateStr,
          time: timeStr.split('.')[0], // Remove milliseconds for display
          temperature,
          fValue,
          timestamp,
          index: i - 1,
        });
      }
    });
  }

  return loggers;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
