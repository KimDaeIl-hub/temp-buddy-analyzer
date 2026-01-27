import { useState, useRef, useCallback } from "react";
import { DataFile, ResultFilter } from "@/types/file";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { AnalysisGroup, AnalysisGroupResult } from "@/types/analysis";
import { calculateSessionResults, getRecordsInSession, calculateProductResults, calculateHotWaterResults } from "@/utils/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, Settings2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ExportGeneratorProps {
  files: DataFile[];
  analysisGroups: AnalysisGroup[];
  resultFilters: ResultFilter[];
  chartRef: React.RefObject<HTMLDivElement>;
  inline?: boolean;
}

interface ReportSettings {
  productName: string;
  operatorName: string;
  facilityName: string;
  validationNotes: string;
}

// Korean to English mappings for PDF
const koreanToEnglish: Record<string, string> = {
  "열수": "Hot Water",
  "품온": "Product Temp",
  "회차": "Session",
  "평균 온도": "Avg Temp",
  "유지 시간": "Duration",
  "분": "min",
  "살균": "Pasteurization",
  "멸균": "Sterilization",
  "측정": "Measurement",
};

// Sanitize text for PDF
const sanitizeForPDF = (text: string): string => {
  if (!text) return "";
  
  const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
  
  if (hasKorean) {
    if (/^\d+차\s*측정$/.test(text)) {
      const num = text.match(/^(\d+)/)?.[1];
      return `Session ${num}`;
    }
    if (/^\d+차$/.test(text)) {
      const num = text.match(/^(\d+)/)?.[1];
      return `Session ${num}`;
    }
    if (/측정\s*\d+$/.test(text)) {
      const num = text.match(/(\d+)$/)?.[1];
      return `Measurement ${num}`;
    }
    
    for (const [korean, english] of Object.entries(koreanToEnglish)) {
      if (text.includes(korean)) {
        text = text.replace(new RegExp(korean, 'g'), english);
      }
    }
    
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
      const numbers = text.match(/\d+/g);
      if (numbers) {
        return `Session ${numbers.join('-')}`;
      }
      return "Session";
    }
  }
  
  return text;
};

// Calculate analysis group result
function calculateGroupResult(
  group: AnalysisGroup,
  files: DataFile[]
): AnalysisGroupResult | null {
  if (group.items.length === 0) return null;

  const itemResults: AnalysisGroupResult['itemResults'] = [];
  let totalRecords = 0;
  let tempSum = 0;
  let tempCount = 0;
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let totalDurationMinutes = 0;
  let totalFValue = 0;

  group.items.forEach(item => {
    let logger = null;
    let session = null;
    
    const [fileId, originalLoggerId] = item.loggerId.includes('::') 
      ? item.loggerId.split('::') 
      : [null, item.loggerId];
    
    for (const file of files) {
      if (fileId && file.id !== fileId) continue;
      
      const foundLogger = file.loggers.find(l => l.id === originalLoggerId || l.id === item.loggerId);
      const foundSession = file.sessions.find(s => s.id === item.sessionId);
      if (foundLogger && foundSession) {
        logger = foundLogger;
        session = foundSession;
        break;
      }
    }
    
    if (!logger || !session) return;

    const sessionRecords = getRecordsInSession(logger.records, session);
    if (sessionRecords.length === 0) return;

    let avgTemp = 0;
    let duration = 0;
    let fValue = 0;

    if (logger.type === 'hotwater') {
      // Get logger-specific temperature
      let setTemp = session.setTemperature || logger.setTemperature || 0;
      if (session.loggerSetTemperatures && session.loggerSetTemperatures[logger.id] !== undefined) {
        setTemp = session.loggerSetTemperatures[logger.id];
      }
      const result = calculateHotWaterResults(sessionRecords, setTemp);
      avgTemp = result.averageTemp;
      duration = result.durationMinutes;
    } else if (logger.type === 'product') {
      const sterilType = logger.sterilizationType || 'pasteurization';
      const result = calculateProductResults(sessionRecords, sterilType);
      avgTemp = result.averageTemp;
      duration = result.durationMinutes;
      fValue = result.sessionFValue;
    }

    sessionRecords.forEach(r => {
      tempSum += r.temperature;
      tempCount++;
      minTemp = Math.min(minTemp, r.temperature);
      maxTemp = Math.max(maxTemp, r.temperature);
    });
    totalRecords += sessionRecords.length;
    totalDurationMinutes += duration;
    totalFValue += fValue;

    itemResults.push({
      loggerId: item.loggerId,
      loggerName: item.loggerName,
      sessionId: item.sessionId,
      sessionName: item.sessionName,
      averageTemp: avgTemp,
      durationMinutes: duration,
      fValue,
      recordCount: sessionRecords.length,
    });
  });

  if (tempCount === 0) return null;

  return {
    groupId: group.id,
    groupName: group.name,
    items: group.items,
    totalRecords,
    averageTemp: tempSum / tempCount,
    minTemp: minTemp === Infinity ? 0 : minTemp,
    maxTemp: maxTemp === -Infinity ? 0 : maxTemp,
    totalDurationMinutes,
    totalFValue,
    itemResults,
  };
}

const CHART_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#06b6d4'];

export function ExportGenerator({ files, analysisGroups, resultFilters, chartRef, inline = false }: ExportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<ReportSettings>({
    productName: "",
    operatorName: "",
    facilityName: "",
    validationNotes: "",
  });
  const filteredChartRef = useRef<HTMLDivElement>(null);

  // Get all loggers and sessions
  const allLoggers = files.flatMap(f => f.loggers);
  const allSessions = files.flatMap(f => f.sessions);
  const totalLoggers = allLoggers.length;
  const totalSessions = allSessions.length;

  // Filter results based on resultFilters
  const getFilteredResults = useCallback(() => {
    const results: ReturnType<typeof calculateSessionResults> = [];
    
    files.forEach(file => {
      file.loggers.forEach(logger => {
        if (!logger.type) return;
        
        const loggerResults = calculateSessionResults(logger, file.sessions);
        
        loggerResults.forEach(result => {
          const isEnabled = resultFilters.length === 0 || resultFilters.some(
            f => f.fileId === file.id && 
                 f.loggerId === logger.id && 
                 f.sessionId === result.sessionId &&
                 f.enabled
          );
          
          if (isEnabled) {
            results.push(result);
          }
        });
      });
    });
    
    return results;
  }, [files, resultFilters]);

  // Get filtered chart data for specific logger and session
  const getFilteredChartData = useCallback(() => {
    const filteredData: { 
      logger: DataLogger; 
      session: MeasurementSession; 
      file: DataFile;
      records: any[];
    }[] = [];

    files.forEach(file => {
      file.loggers.forEach(logger => {
        if (!logger.type) return;
        
        file.sessions.forEach(session => {
          const isEnabled = resultFilters.length === 0 || resultFilters.some(
            f => f.fileId === file.id && 
                 f.loggerId === logger.id && 
                 f.sessionId === session.id &&
                 f.enabled
          );
          
          if (isEnabled) {
            const records = getRecordsInSession(logger.records, session);
            if (records.length > 0) {
              filteredData.push({
                logger,
                session,
                file,
                records
              });
            }
          }
        });
      });
    });

    return filteredData;
  }, [files, resultFilters]);

  // Format time for chart display
  const formatTimeForChart = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Render mini charts for filtered data - using session time range for full coverage
  const renderFilteredCharts = useCallback(async (pdf: jsPDF, yPos: number, margin: number, pageWidth: number): Promise<number> => {
    const filteredData = getFilteredChartData();
    
    if (filteredData.length === 0) return yPos;

    // Group by file and session
    const groupedByFileSession = new Map<string, typeof filteredData>();
    filteredData.forEach(item => {
      const key = `${item.file.id}-${item.session.id}`;
      if (!groupedByFileSession.has(key)) {
        groupedByFileSession.set(key, []);
      }
      groupedByFileSession.get(key)!.push(item);
    });

    for (const [key, items] of groupedByFileSession) {
      const firstItem = items[0];
      const session = firstItem.session;
      const file = firstItem.file;
      
      // Create chart container - larger for better quality
      const chartContainer = document.createElement('div');
      chartContainer.style.width = '900px';
      chartContainer.style.height = '400px';
      chartContainer.style.position = 'absolute';
      chartContainer.style.left = '-9999px';
      chartContainer.style.backgroundColor = 'white';
      document.body.appendChild(chartContainer);

      // Use session's defined time range to ensure FULL session is shown on X-axis
      const sessionStart = session.startTime.getTime();
      const sessionEnd = session.endTime.getTime();
      const sessionDuration = sessionEnd - sessionStart;

      // Target ~180 points across the full session duration
      const targetPoints = 180;
      const timeStep = Math.max(1000, Math.floor(sessionDuration / targetPoints));

      // Create time slots spanning the ENTIRE session
      const dataMap = new Map<number, any>();
      for (let t = sessionStart; t <= sessionEnd; t += timeStep) {
        dataMap.set(t, { time: formatTimeForChart(new Date(t)) });
      }
      // Always include the exact session end time
      if (!dataMap.has(sessionEnd)) {
        dataMap.set(sessionEnd, { time: formatTimeForChart(new Date(sessionEnd)) });
      }

      // Fill temperature values from each logger using binary search for closest match
      items.forEach((item, idx) => {
        const records = item.records;
        if (!records || records.length === 0) return;

        const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        dataMap.forEach((point, timestamp) => {
          // Binary search to find closest record
          let lo = 0, hi = sorted.length - 1;
          while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (sorted[mid].timestamp.getTime() < timestamp) lo = mid + 1;
            else hi = mid;
          }
          // Check both lo and lo-1 for closest
          let best = lo;
          if (lo > 0) {
            const d1 = Math.abs(sorted[lo].timestamp.getTime() - timestamp);
            const d2 = Math.abs(sorted[lo - 1].timestamp.getTime() - timestamp);
            if (d2 < d1) best = lo - 1;
          }
          const rec = sorted[best];
          const diff = Math.abs(rec.timestamp.getTime() - timestamp);
          // Only use if within 3x time step
          if (diff < timeStep * 3) {
            point[`temp${idx}`] = rec.temperature;
            if (rec.fValue !== undefined && rec.fValue !== null) {
              point[`fvalue${idx}`] = rec.fValue;
            }
          }
        });
      });

      const chartData: any[] = Array.from(dataMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, point], index) => ({ index, ...point }));

      // Calculate Y-axis domain based on actual data
      let minTemp = Infinity;
      let maxTemp = -Infinity;
      items.forEach(item => {
        item.records.forEach(r => {
          minTemp = Math.min(minTemp, r.temperature);
          maxTemp = Math.max(maxTemp, r.temperature);
        });
      });
      const yPadding = (maxTemp - minTemp) * 0.1;
      const yMin = Math.floor(minTemp - yPadding);
      const yMax = Math.ceil(maxTemp + yPadding);

      // Render chart using React
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(chartContainer);
      
      await new Promise<void>((resolve) => {
        root.render(
          <div style={{ width: '100%', height: '100%', padding: '20px', backgroundColor: 'white' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>
              {sanitizeForPDF(files.length > 1 ? `[${file.name.replace('.csv', '')}] ${session.name}` : session.name)}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 8 }} 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
                />
                <YAxis 
                  domain={[yMin, yMax]} 
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Temperature (\u00B0C)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                {items.map((item, idx) => (
                  <Line
                    key={idx}
                    type="monotone"
                    dataKey={`temp${idx}`}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    name={sanitizeForPDF(item.logger.name)}
                    connectNulls
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Tooltip 
                  contentStyle={{ fontSize: '11px' }}
                  formatter={(value: number) => [`${value.toFixed(1)}\u00B0C`]}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
        
        setTimeout(resolve, 400);
      });

      // Capture to canvas with higher resolution
      try {
        const canvas = await html2canvas(chartContainer, {
          backgroundColor: '#ffffff',
          scale: 2.5,
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Check if need new page
        const pageHeight = pdf.internal.pageSize.getHeight();
        if (yPos + imgHeight + 20 > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
        yPos += imgHeight + 15;
      } catch (error) {
        console.error('Failed to capture filtered chart:', error);
      }

      root.unmount();
      document.body.removeChild(chartContainer);
    }

    return yPos;
  }, [files, getFilteredChartData]);

  const generateExcel = async () => {
    setIsGenerating(true);
    
    try {
      const workbook = XLSX.utils.book_new();
      const allResults = getFilteredResults();
      
      // ===== 1. Summary Sheet (PDF 스타일로 개선) =====
      const summaryData: any[][] = [];
      
      // Title with styling info
      summaryData.push(['']);
      summaryData.push(['   VALIDATION REPORT']);
      summaryData.push(['']);
      summaryData.push(['═══════════════════════════════════════════════════════════════']);
      summaryData.push(['']);
      summaryData.push(['   REPORT INFORMATION']);
      summaryData.push(['   ─────────────────────────────────────────────────────────────']);
      summaryData.push(['   Issue Date:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })]);
      summaryData.push(['   Product Name:', settings.productName || '(Not specified)']);
      summaryData.push(['   Operator:', settings.operatorName || '(Not specified)']);
      summaryData.push(['   Facility:', settings.facilityName || '(Not specified)']);
      summaryData.push(['']);
      summaryData.push(['   DATA SUMMARY']);
      summaryData.push(['   ─────────────────────────────────────────────────────────────']);
      summaryData.push(['   Total Files:', files.length]);
      summaryData.push(['   Total Data Loggers:', totalLoggers]);
      summaryData.push(['   Hot Water Loggers:', allLoggers.filter(l => l.type === 'hotwater').length]);
      summaryData.push(['   Product Temp Loggers:', allLoggers.filter(l => l.type === 'product').length]);
      summaryData.push(['   Total Sessions:', totalSessions]);
      summaryData.push(['']);
      
      if (settings.validationNotes) {
        summaryData.push(['   VERIFICATION NOTES']);
        summaryData.push(['   ─────────────────────────────────────────────────────────────']);
        summaryData.push([`   ${settings.validationNotes}`]);
        summaryData.push(['']);
      }
      
      summaryData.push(['═══════════════════════════════════════════════════════════════']);
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // ===== 2. Hot Water Results Sheet =====
      const hotwaterResults = allResults.filter(r => r.loggerType === 'hotwater');
      if (hotwaterResults.length > 0) {
        const hwData: any[][] = [];
        hwData.push(['']);
        hwData.push(['   HOT WATER MEASUREMENT RESULTS']);
        hwData.push(['═══════════════════════════════════════════════════════════════════════════════════════════════════']);
        hwData.push(['']);
        hwData.push(['   File', 'Logger Name', 'Session', 'Set Temp (°C)', 'Threshold (°C)', 'Avg Temp (°C)', 'Duration (min)', 'Status']);
        hwData.push(['   ────────────', '────────────────────', '────────────', '────────────', '────────────', '────────────', '────────────', '────────']);
        
        hotwaterResults.forEach(r => {
          let fileName = '-';
          for (const file of files) {
            const foundLogger = file.loggers.find(l => l.name === r.loggerName || l.id === r.loggerId);
            if (foundLogger) {
              fileName = file.name.replace('.csv', '');
              break;
            }
          }
          
          const threshold = r.threshold || 0;
          const status = r.averageTemp >= threshold ? '✓ PASS' : '✗ FAIL';
          
          hwData.push([
            `   ${fileName}`,
            r.loggerName,
            r.sessionName,
            (threshold + 2.4).toFixed(1),
            threshold.toFixed(1),
            r.averageTemp.toFixed(2),
            r.durationMinutes.toFixed(1),
            status
          ]);
        });
        
        if (hotwaterResults.length > 1) {
          const avgTemp = hotwaterResults.reduce((sum, r) => sum + r.averageTemp, 0) / hotwaterResults.length;
          const totalDuration = hotwaterResults.reduce((sum, r) => sum + r.durationMinutes, 0);
          hwData.push(['   ────────────', '────────────────────', '────────────', '────────────', '────────────', '────────────', '────────────', '────────']);
          hwData.push(['', '', '   SUMMARY', '', '', avgTemp.toFixed(2), totalDuration.toFixed(1), '']);
        }
        
        hwData.push(['']);
        hwData.push(['═══════════════════════════════════════════════════════════════════════════════════════════════════']);
        
        const hwSheet = XLSX.utils.aoa_to_sheet(hwData);
        hwSheet['!cols'] = [
          { wch: 18 }, { wch: 22 }, { wch: 15 }, { wch: 14 }, 
          { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(workbook, hwSheet, 'Hot Water Results');
      }
      
      // ===== 3. Product Temperature Results Sheet =====
      const productResults = allResults.filter(r => r.loggerType === 'product');
      if (productResults.length > 0) {
        const prodData: any[][] = [];
        prodData.push(['']);
        prodData.push(['   PRODUCT TEMPERATURE MEASUREMENT RESULTS']);
        prodData.push(['═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════']);
        prodData.push(['']);
        prodData.push(['   File', 'Logger Name', 'Session', 'Type', 'Threshold (°C)', 'Avg Temp (°C)', 'Duration (min)', 'F-Value', 'Status']);
        prodData.push(['   ────────────', '──────────────────', '──────────', '──────────────────────', '────────────', '────────────', '────────────', '────────────', '────────']);
        
        productResults.forEach(r => {
          let fileName = '-';
          for (const file of files) {
            const foundLogger = file.loggers.find(l => l.name === r.loggerName || l.id === r.loggerId);
            if (foundLogger) {
              fileName = file.name.replace('.csv', '');
              break;
            }
          }
          
          const isSterilization = r.sterilizationType === 'sterilization';
          const fValueType = isSterilization ? 'Sterilization (F121°C)' : 'Pasteurization (F63°C)';
          const threshold = isSterilization ? 121 : 63;
          const fValue = r.sessionFValue || 0;
          const status = fValue > 0 ? '✓ PASS' : '✗ FAIL';
          
          prodData.push([
            `   ${fileName}`,
            r.loggerName,
            r.sessionName,
            fValueType,
            threshold.toFixed(1),
            r.averageTemp.toFixed(2),
            r.durationMinutes.toFixed(1),
            fValue.toFixed(4),
            status
          ]);
        });
        
        if (productResults.length > 1) {
          const avgTemp = productResults.reduce((sum, r) => sum + r.averageTemp, 0) / productResults.length;
          const totalDuration = productResults.reduce((sum, r) => sum + r.durationMinutes, 0);
          const avgFValue = productResults.reduce((sum, r) => sum + (r.sessionFValue || 0), 0) / productResults.length;
          prodData.push(['   ────────────', '──────────────────', '──────────', '──────────────────────', '────────────', '────────────', '────────────', '────────────', '────────']);
          prodData.push(['', '', '   SUMMARY', '', '', avgTemp.toFixed(2), totalDuration.toFixed(1), avgFValue.toFixed(4), '']);
        }
        
        prodData.push(['']);
        prodData.push(['═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════']);
        
        const prodSheet = XLSX.utils.aoa_to_sheet(prodData);
        prodSheet['!cols'] = [
          { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 24 }, 
          { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(workbook, prodSheet, 'Product Temp Results');
      }
      
      // ===== 4. Analysis Groups Sheet =====
      if (analysisGroups.length > 0) {
        const groupData: any[][] = [];
        groupData.push(['']);
        groupData.push(['   CUSTOM ANALYSIS GROUPS']);
        groupData.push(['═══════════════════════════════════════════════════════════════════════════════════════']);
        groupData.push(['']);
        
        analysisGroups.forEach((group, groupIdx) => {
          const result = calculateGroupResult(group, files);
          if (!result) return;
          
          const avgTemp = result.itemResults.reduce((sum, i) => sum + i.averageTemp, 0) / result.itemResults.length;
          const avgDuration = result.totalDurationMinutes / result.itemResults.length;
          const avgFValue = result.totalFValue / result.itemResults.length;
          
          groupData.push([`   ▶ GROUP ${groupIdx + 1}: ${group.name}`]);
          groupData.push(['   ─────────────────────────────────────────────────────────────────────────────────']);
          groupData.push([`   Summary:`, `Avg Temp: ${avgTemp.toFixed(2)}°C`, `Avg Duration: ${avgDuration.toFixed(1)} min`, `Avg F-Value: ${avgFValue.toFixed(4)}`]);
          groupData.push(['']);
          groupData.push(['   Logger', 'Session', 'Avg Temp (°C)', 'Duration (min)', 'F-Value']);
          groupData.push(['   ──────────────────────', '──────────────', '────────────', '────────────', '────────────']);
          
          result.itemResults.forEach(item => {
            groupData.push([
              `   ${item.loggerName}`,
              item.sessionName,
              item.averageTemp.toFixed(2),
              item.durationMinutes.toFixed(1),
              item.fValue.toFixed(4)
            ]);
          });
          
          groupData.push(['']);
          groupData.push(['']);
        });
        
        groupData.push(['═══════════════════════════════════════════════════════════════════════════════════════']);
        
        const groupSheet = XLSX.utils.aoa_to_sheet(groupData);
        groupSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, groupSheet, 'Analysis Groups');
      }
      
      // ===== 5. Raw Data Sheets =====
      files.forEach(file => {
        file.loggers.forEach(logger => {
          if (logger.records.length === 0) return;
          
          const rawData: any[][] = [];
          rawData.push(['']);
          rawData.push([`   RAW DATA: ${logger.name}`]);
          rawData.push([`   File: ${file.name}`]);
          rawData.push([`   Type: ${logger.type === 'hotwater' ? 'Hot Water' : logger.type === 'product' ? 'Product Temp' : 'Not Configured'}`]);
          rawData.push(['═══════════════════════════════════════════════════════════════════════']);
          rawData.push(['']);
          rawData.push(['   #', 'Date', 'Time', 'Temperature (°C)', 'F-Value']);
          rawData.push(['   ────', '────────────', '──────────', '────────────────', '────────────']);
          
          logger.records.forEach((r, idx) => {
            rawData.push([
              `   ${idx + 1}`,
              r.date,
              r.time,
              r.temperature.toFixed(2),
              r.fValue !== undefined ? r.fValue.toFixed(6) : '-'
            ]);
          });
          
          // Statistics
          const temps = logger.records.map(r => r.temperature);
          const minTemp = Math.min(...temps);
          const maxTemp = Math.max(...temps);
          const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
          
          rawData.push(['']);
          rawData.push(['═══════════════════════════════════════════════════════════════════════']);
          rawData.push(['   STATISTICS']);
          rawData.push(['   ─────────────────────────────────────────────────────────────────────']);
          rawData.push(['   Min Temperature:', '', '', minTemp.toFixed(2) + ' °C']);
          rawData.push(['   Max Temperature:', '', '', maxTemp.toFixed(2) + ' °C']);
          rawData.push(['   Avg Temperature:', '', '', avgTemp.toFixed(2) + ' °C']);
          rawData.push(['   Total Records:', '', '', logger.records.length.toString()]);
          rawData.push(['═══════════════════════════════════════════════════════════════════════']);
          
          const sheetName = `${file.name.replace('.csv', '').substring(0, 15)}_${logger.name}`.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '_');
          const rawSheet = XLSX.utils.aoa_to_sheet(rawData);
          rawSheet['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 15 }];
          XLSX.utils.book_append_sheet(workbook, rawSheet, sheetName);
        });
      });
      
      // Save
      const fileName = settings.productName
        ? `validation_report_${settings.productName.replace(/\s+/g, "_")}.xlsx`
        : `validation_report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      if (!inline) setIsOpen(false);
    } catch (error) {
      console.error("Excel generation failed:", error);
      alert("Excel generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      const checkNewPage = (height: number) => {
        if (yPos + height > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("VALIDATION REPORT", margin, 18);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      pdf.text(`Issue Date: ${today}`, margin, 28);
      
      if (settings.facilityName) {
        pdf.text(`Facility: ${settings.facilityName}`, pageWidth - margin - 60, 28);
      }

      yPos = 45;
      pdf.setTextColor(0, 0, 0);

      // Summary
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("I. EXECUTIVE SUMMARY", margin, yPos);
      yPos += 8;

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      const configuredLoggers = allLoggers.filter((l) => l.type !== null);
      const cardWidth = (pageWidth - margin * 2 - 15) / 4;
      const cardHeight = 25;
      
      const summaryData = [
        { label: "Total Files", value: files.length.toString() },
        { label: "Hot Water", value: configuredLoggers.filter((l) => l.type === "hotwater").length.toString() },
        { label: "Product", value: configuredLoggers.filter((l) => l.type === "product").length.toString() },
        { label: "Sessions", value: totalSessions.toString() },
      ];

      summaryData.forEach((item, idx) => {
        const x = margin + idx * (cardWidth + 5);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, "F");
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(item.label, x + 5, yPos + 8);
        
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
        pdf.text(item.value, x + 5, yPos + 19);
        pdf.setFont("helvetica", "normal");
      });

      yPos += cardHeight + 15;

      // Product Info
      if (settings.productName || settings.operatorName) {
        checkNewPage(30);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(59, 130, 246);
        pdf.text("II. PRODUCT DETAILS", margin, yPos);
        yPos += 8;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");

        if (settings.productName) {
          pdf.text(`Product Name: ${settings.productName}`, margin, yPos);
          yPos += 6;
        }
        if (settings.operatorName) {
          pdf.text(`Operator: ${settings.operatorName}`, margin, yPos);
          yPos += 6;
        }
        yPos += 8;
      }

      // Results
      const allResults = getFilteredResults();
      
      checkNewPage(40);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("III. SESSION ANALYSIS RESULTS", margin, yPos);
      yPos += 8;

      // Hot Water
      const hotwaterResults = allResults.filter((r) => r.loggerType === "hotwater");
      if (hotwaterResults.length > 0) {
        checkNewPage(40);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("Hot Water Measurements", margin, yPos);
        yPos += 5;

        autoTable(pdf, {
          startY: yPos,
          head: [["Logger", "Session", "Threshold", "Avg Temp", "Duration"]],
          body: hotwaterResults.map((r) => [
            sanitizeForPDF(r.loggerName),
            sanitizeForPDF(r.sessionName),
            `>= ${r.threshold?.toFixed(1)}\u00B0C`,
            `${r.averageTemp.toFixed(2)}\u00B0C`,
            `${r.durationMinutes.toFixed(1)} min`,
          ]),
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [14, 165, 233], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        yPos = (pdf as any).lastAutoTable.finalY + 10;
      }

      // Product
      const productResults = allResults.filter((r) => r.loggerType === "product");
      if (productResults.length > 0) {
        checkNewPage(40);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("Product Temperature Measurements", margin, yPos);
        yPos += 5;

        autoTable(pdf, {
          startY: yPos,
          head: [["Logger", "Session", "Avg Temp", "Duration", "F-Value"]],
          body: productResults.map((r) => {
            const isSterilization = r.sterilizationType === "sterilization";
            const fValueLabel = isSterilization ? "F121\u00B0C" : "F63\u00B0C";
            return [
              sanitizeForPDF(r.loggerName),
              sanitizeForPDF(r.sessionName),
              `${r.averageTemp.toFixed(2)}\u00B0C`,
              `${r.durationMinutes.toFixed(1)} min`,
              `${fValueLabel}: ${r.sessionFValue?.toFixed(2) || "0.00"}`,
            ];
          }),
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [34, 197, 94], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        yPos = (pdf as any).lastAutoTable.finalY + 10;
      }

      // Analysis Groups
      if (analysisGroups.length > 0) {
        const groupsWithResults = analysisGroups
          .map(group => ({
            group,
            result: calculateGroupResult(group, files)
          }))
          .filter(({ result }) => result !== null);

        if (groupsWithResults.length > 0) {
          checkNewPage(40);
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(59, 130, 246);
          pdf.text("IV. CUSTOM ANALYSIS GROUPS", margin, yPos);
          yPos += 8;

          groupsWithResults.forEach(({ group, result }) => {
            if (!result) return;

            checkNewPage(50);
            
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Group: ${sanitizeForPDF(group.name)}`, margin, yPos);
            yPos += 5;

            const avgTemp = result.itemResults.reduce((sum, i) => sum + i.averageTemp, 0) / result.itemResults.length;
            const avgDuration = result.totalDurationMinutes / result.itemResults.length;
            const avgFValue = result.totalFValue / result.itemResults.length;

            pdf.setFontSize(9);
            pdf.setFont("helvetica", "normal");
            pdf.text(
              `Avg Temp: ${avgTemp.toFixed(2)}\u00B0C | Avg Duration: ${avgDuration.toFixed(1)} min | Avg F-Value: ${avgFValue.toFixed(2)}`,
              margin,
              yPos
            );
            yPos += 5;

            autoTable(pdf, {
              startY: yPos,
              head: [["Logger", "Session", "Avg Temp", "Duration", "F-Value"]],
              body: result.itemResults.map((item) => [
                sanitizeForPDF(item.loggerName),
                sanitizeForPDF(item.sessionName),
                `${item.averageTemp.toFixed(2)}\u00B0C`,
                `${item.durationMinutes.toFixed(1)} min`,
                item.fValue.toFixed(2),
              ]),
              margin: { left: margin, right: margin },
              styles: { fontSize: 7, cellPadding: 2 },
              headStyles: { fillColor: [124, 58, 237], textColor: 255 },
              alternateRowStyles: { fillColor: [248, 250, 252] },
            });

            yPos = (pdf as any).lastAutoTable.finalY + 10;
          });
        }
      }

      // Notes (before charts)
      if (settings.validationNotes) {
        checkNewPage(40);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(59, 130, 246);
        const sectionNum = analysisGroups.length > 0 ? "V" : "IV";
        pdf.text(`${sectionNum}. VERIFICATION NOTES`, margin, yPos);
        yPos += 8;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        
        const splitNotes = pdf.splitTextToSize(settings.validationNotes, pageWidth - margin * 2);
        pdf.text(splitNotes, margin, yPos);
        yPos += splitNotes.length * 5 + 10;
      }

      // Temperature Profile Charts (at the end)
      checkNewPage(80);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      const chartSectionNum = settings.validationNotes 
        ? (analysisGroups.length > 0 ? "VI" : "V")
        : (analysisGroups.length > 0 ? "V" : "IV");
      pdf.text(`${chartSectionNum}. TEMPERATURE PROFILES`, margin, yPos);
      yPos += 8;

      // Render filtered charts
      yPos = await renderFilteredCharts(pdf, yPos, margin, pageWidth);

      // Footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Page ${i} of ${pageCount} | Generated by Temperature Logger Analyzer`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save
      const fileName = settings.productName
        ? `validation_report_${settings.productName.replace(/\s+/g, "_")}.pdf`
        : `validation_report_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      if (!inline) setIsOpen(false);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isReady = files.length > 0 && totalSessions > 0;
  const filteredCount = resultFilters.filter(f => f.enabled).length;

  if (inline) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4" />
                리포트 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">제품명</Label>
                <Input
                  id="productName"
                  placeholder="예: 제품 A"
                  value={settings.productName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, productName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatorName">작업자</Label>
                <Input
                  id="operatorName"
                  placeholder="예: 홍길동"
                  value={settings.operatorName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, operatorName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityName">시설명</Label>
                <Input
                  id="facilityName"
                  placeholder="예: A 공장"
                  value={settings.facilityName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, facilityName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">검증 메모</Label>
                <Textarea
                  id="notes"
                  placeholder="추가 메모..."
                  rows={3}
                  value={settings.validationNotes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, validationNotes: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                리포트 미리보기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground">발행일</div>
                  <div className="text-sm font-medium">{new Date().toLocaleDateString("ko-KR")}</div>
                </div>
                <div className="text-lg font-bold text-primary mb-2">VALIDATION REPORT</div>
                {settings.productName && (
                  <div className="text-sm text-muted-foreground">제품: {settings.productName}</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">포함 내용</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="whitespace-nowrap">선택된 온도 그래프</Badge>
                  <Badge variant="secondary" className="whitespace-nowrap">회차별 결과</Badge>
                  <Badge variant="secondary" className="whitespace-nowrap">열수 분석</Badge>
                  <Badge variant="secondary" className="whitespace-nowrap">품온 분석</Badge>
                  {analysisGroups.length > 0 && (
                    <Badge variant="secondary" className="whitespace-nowrap">분석 그룹 ({analysisGroups.length})</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-primary/10">
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">파일</div>
                  <div className="text-lg font-bold text-primary">{files.length}</div>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">로거</div>
                  <div className="text-lg font-bold text-primary">{totalLoggers}</div>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">회차</div>
                  <div className="text-lg font-bold text-primary">{totalSessions}</div>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap">선택</div>
                  <div className="text-lg font-bold text-primary">{filteredCount || 'All'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button onClick={generatePDF} disabled={isGenerating || !isReady} className="flex-1">
            {isGenerating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                생성 중...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                PDF 다운로드
              </>
            )}
          </Button>
          <Button onClick={generateExcel} disabled={isGenerating || !isReady} variant="outline" className="flex-1">
            {isGenerating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                생성 중...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel 다운로드
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={!isReady}>
          <FileDown className="w-4 h-4" />
          리포트
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            리포트 생성
          </DialogTitle>
          <DialogDescription>
            분석 결과를 PDF 또는 Excel로 내보냅니다
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4" />
                리포트 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName2">제품명</Label>
                <Input
                  id="productName2"
                  placeholder="예: 제품 A"
                  value={settings.productName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, productName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatorName2">작업자</Label>
                <Input
                  id="operatorName2"
                  placeholder="예: 홍길동"
                  value={settings.operatorName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, operatorName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityName2">시설명</Label>
                <Input
                  id="facilityName2"
                  placeholder="예: A 공장"
                  value={settings.facilityName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, facilityName: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                리포트 미리보기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="text-xs text-muted-foreground">파일</div>
                  <div className="text-xl font-bold text-primary">{files.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="text-xs text-muted-foreground">로거</div>
                  <div className="text-xl font-bold text-primary">{totalLoggers}</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="text-xs text-muted-foreground">회차</div>
                  <div className="text-xl font-bold text-primary">{totalSessions}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            취소
          </Button>
          <Button onClick={generateExcel} disabled={isGenerating || !isReady} variant="secondary">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating || !isReady}>
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}