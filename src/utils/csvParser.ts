import { DataLogger, TemperatureRecord } from "@/types/temperature";

export function parseCSVContent(content: string): DataLogger[] {
  const loggers: DataLogger[] = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return loggers;
  
  // Parse header to find logger columns
  const headerLine = lines[0];
  const headers = headerLine.split(';');
  
  // Find all temperature columns (pattern: pv######)
  const loggerColumns: { index: number; name: string; hasFValue: boolean }[] = [];
  
  headers.forEach((header, index) => {
    // Clean header from encoding issues
    const cleanHeader = header.replace(/[^\x20-\x7E가-힣]/g, '').trim();
    
    // Match patterns like "pv144556(File 1) 1- Temperature" or similar
    const pvMatch = cleanHeader.match(/pv\d+/i);
    if (pvMatch || cleanHeader.toLowerCase().includes('temperature')) {
      // Check if next column might be F-value for this logger
      const nextHeader = headers[index + 1]?.replace(/[^\x20-\x7E가-힣]/g, '').trim().toLowerCase();
      const hasFValue = nextHeader?.includes('f') || nextHeader?.includes('value') || false;
      
      loggerColumns.push({ 
        index, 
        name: pvMatch ? pvMatch[0] : `Logger ${loggerColumns.length + 1}`,
        hasFValue
      });
    }
  });

  // If no specific logger columns found, assume single logger with columns: date, time, temp, [fvalue]
  if (loggerColumns.length === 0 && headers.length >= 3) {
    loggerColumns.push({ index: 2, name: 'Logger 1', hasFValue: headers.length >= 4 });
  }

  // Initialize loggers
  loggerColumns.forEach((col, idx) => {
    loggers.push({
      id: `logger-${idx + 1}`,
      name: col.name,
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
        if (col.hasFValue) {
          const fValueStr = values[col.index + 1]?.trim().replace(',', '.');
          if (fValueStr && !isNaN(parseFloat(fValueStr))) {
            fValue = parseFloat(fValueStr);
          }
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

// Try multiple encodings for file reading
export async function readFileWithEncoding(file: File): Promise<string> {
  // Try UTF-8 first
  try {
    const utf8Content = await file.text();
    // Check if content looks valid (has readable characters)
    if (utf8Content.includes('pv') || utf8Content.includes('Temperature')) {
      return utf8Content;
    }
  } catch (e) {
    // Continue to try other encodings
  }
  
  // Try with different encodings using TextDecoder
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
  
  // Fallback to UTF-8
  return await file.text();
}
