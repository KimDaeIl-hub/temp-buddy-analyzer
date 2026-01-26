import { DataLogger, TemperatureRecord } from "@/types/temperature";

export function parseCSVContent(content: string): DataLogger[] {
  const loggers: DataLogger[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return loggers;
  
  let currentLogger: DataLogger | null = null;
  let hasFValueColumn = false;
  let recordIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(';');
    
    // Check if this line is a header (contains "pv" pattern)
    const headerMatch = line.match(/pv(\d+)/i);
    if (headerMatch && (line.toLowerCase().includes('temperature') || line.toLowerCase().includes('hour'))) {
      // This is a header line - start new logger
      if (currentLogger && currentLogger.records.length > 0) {
        loggers.push(currentLogger);
      }
      
      const loggerName = `pv${headerMatch[1]}`;
      
      // Check if this logger has F-value column
      hasFValueColumn = line.toLowerCase().includes('fo') || line.toLowerCase().includes('f value');
      
      currentLogger = {
        id: `logger-${loggers.length + 1}`,
        name: loggerName,
        type: null,
        records: [],
      };
      recordIndex = 0;
      continue;
    }
    
    // Parse data row
    if (!currentLogger) {
      // First data row before any header - create default logger
      const firstHeaderMatch = line.match(/pv(\d+)/i);
      if (firstHeaderMatch) {
        currentLogger = {
          id: 'logger-1',
          name: `pv${firstHeaderMatch[1]}`,
          type: null,
          records: [],
        };
        continue;
      }
    }
    
    if (!currentLogger) continue;
    
    // Try to parse as data row
    if (values.length < 3) continue;
    
    const dateStr = values[0]?.trim();
    const timeStr = values[1]?.trim();
    const tempStr = values[2]?.trim().replace(',', '.');
    
    // Validate date format (DD/MM/YYYY)
    if (!dateStr || !dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;
    if (!timeStr || !timeStr.match(/^\d{2}:\d{2}:\d{2}/)) continue;
    
    const temperature = parseFloat(tempStr);
    if (isNaN(temperature)) continue;
    
    // Parse date
    const dateParts = dateStr.split('/');
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    
    // Parse time
    const timeParts = timeStr.split(':');
    const hours = parseInt(timeParts[0] || '0', 10);
    const minutes = parseInt(timeParts[1] || '0', 10);
    const seconds = parseFloat(timeParts[2] || '0');
    
    const timestamp = new Date(year, month, day, hours, minutes, Math.floor(seconds));
    
    // Parse F-value if exists
    let fValue: number | undefined;
    if (hasFValueColumn && values[3]) {
      const fValueStr = values[3].trim().replace(',', '.');
      if (fValueStr && !isNaN(parseFloat(fValueStr))) {
        fValue = parseFloat(fValueStr);
      }
    }
    
    currentLogger.records.push({
      date: dateStr,
      time: timeStr.split('.')[0],
      temperature,
      fValue,
      timestamp,
      index: recordIndex++,
    });
  }
  
  // Add last logger
  if (currentLogger && currentLogger.records.length > 0) {
    loggers.push(currentLogger);
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

// Try multiple encodings for file reading
export async function readFileWithEncoding(file: File): Promise<string> {
  // Try UTF-8 first
  try {
    const utf8Content = await file.text();
    if (utf8Content.includes('pv') || utf8Content.includes('Temperature')) {
      return utf8Content;
    }
  } catch (e) {
    // Continue to try other encodings
  }
  
  // Try with different encodings
  const encodings = ['euc-kr', 'cp949', 'iso-8859-1', 'windows-1252'];
  const buffer = await file.arrayBuffer();
  
  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding);
      const content = decoder.decode(buffer);
      if (content.includes('pv') || content.includes('Temperature') || content.includes('temperature')) {
        return content;
      }
    } catch (e) {
      // Continue to next encoding
    }
  }
  
  return await file.text();
}
