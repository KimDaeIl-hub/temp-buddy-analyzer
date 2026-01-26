import { useState } from "react";
import { DataFile, ResultFilter } from "@/types/file";
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
    // Find logger and session across all files
    let logger = null;
    let session = null;
    
    for (const file of files) {
      const foundLogger = file.loggers.find(l => l.id === item.loggerId);
      const foundSession = file.sessions.find(s => s.id === item.sessionId);
      if (foundLogger) logger = foundLogger;
      if (foundSession) session = foundSession;
    }
    
    if (!logger || !session) return;

    const sessionRecords = getRecordsInSession(logger.records, session);
    if (sessionRecords.length === 0) return;

    let avgTemp = 0;
    let duration = 0;
    let fValue = 0;

    if (logger.type === 'hotwater') {
      const setTemp = session.setTemperature || logger.setTemperature || 0;
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

export function ExportGenerator({ files, analysisGroups, resultFilters, chartRef, inline = false }: ExportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<ReportSettings>({
    productName: "",
    operatorName: "",
    facilityName: "",
    validationNotes: "",
  });

  // Get all loggers and sessions
  const allLoggers = files.flatMap(f => f.loggers);
  const allSessions = files.flatMap(f => f.sessions);
  const totalLoggers = allLoggers.length;
  const totalSessions = allSessions.length;

  // Filter results based on resultFilters
  const getFilteredResults = () => {
    const results: ReturnType<typeof calculateSessionResults> = [];
    
    files.forEach(file => {
      file.loggers.forEach(logger => {
        if (!logger.type) return;
        
        const loggerResults = calculateSessionResults(logger, file.sessions);
        
        loggerResults.forEach(result => {
          // Check if this result passes the filter
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
  };

  const generateExcel = async () => {
    setIsGenerating(true);
    
    try {
      const workbook = XLSX.utils.book_new();
      const allResults = getFilteredResults();
      
      // Summary sheet
      const summaryData = [
        ['Validation Report'],
        [''],
        ['Report Date', new Date().toLocaleDateString()],
        ['Product Name', settings.productName || '-'],
        ['Operator', settings.operatorName || '-'],
        ['Facility', settings.facilityName || '-'],
        [''],
        ['Summary'],
        ['Total Files', files.length],
        ['Total Loggers', totalLoggers],
        ['Total Sessions', totalSessions],
        ['Hot Water Loggers', allLoggers.filter(l => l.type === 'hotwater').length],
        ['Product Loggers', allLoggers.filter(l => l.type === 'product').length],
      ];
      
      if (settings.validationNotes) {
        summaryData.push([''], ['Notes', settings.validationNotes]);
      }
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Hot Water Results
      const hotwaterResults = allResults.filter(r => r.loggerType === 'hotwater');
      if (hotwaterResults.length > 0) {
        const hwData = [
          ['Logger', 'Session', 'Threshold (°C)', 'Avg Temp (°C)', 'Duration (min)', 'Records'],
          ...hotwaterResults.map(r => [
            r.loggerName,
            r.sessionName,
            r.threshold?.toFixed(1) || '-',
            r.averageTemp.toFixed(2),
            r.durationMinutes.toFixed(1),
            r.recordCount,
          ])
        ];
        const hwSheet = XLSX.utils.aoa_to_sheet(hwData);
        XLSX.utils.book_append_sheet(workbook, hwSheet, 'Hot Water');
      }
      
      // Product Results
      const productResults = allResults.filter(r => r.loggerType === 'product');
      if (productResults.length > 0) {
        const prodData = [
          ['Logger', 'Session', 'Avg Temp (°C)', 'Duration (min)', 'F-Value', 'Type'],
          ...productResults.map(r => [
            r.loggerName,
            r.sessionName,
            r.averageTemp.toFixed(2),
            r.durationMinutes.toFixed(1),
            r.sessionFValue?.toFixed(2) || '0.00',
            r.sterilizationType === 'sterilization' ? 'F121°C' : 'F63°C',
          ])
        ];
        const prodSheet = XLSX.utils.aoa_to_sheet(prodData);
        XLSX.utils.book_append_sheet(workbook, prodSheet, 'Product Temp');
      }
      
      // Analysis Groups
      if (analysisGroups.length > 0) {
        const groupData: any[][] = [['Group Name', 'Avg Temp (°C)', 'Avg Duration (min)', 'Avg F-Value', 'Items']];
        
        analysisGroups.forEach(group => {
          const result = calculateGroupResult(group, files);
          if (result) {
            const avgTemp = result.itemResults.reduce((sum, i) => sum + i.averageTemp, 0) / result.itemResults.length;
            const avgDuration = result.totalDurationMinutes / result.itemResults.length;
            const avgFValue = result.totalFValue / result.itemResults.length;
            
            groupData.push([
              group.name,
              avgTemp.toFixed(2),
              avgDuration.toFixed(1),
              avgFValue.toFixed(2),
              result.itemResults.map(i => `${i.loggerName} - ${i.sessionName}`).join(', ')
            ]);
          }
        });
        
        const groupSheet = XLSX.utils.aoa_to_sheet(groupData);
        XLSX.utils.book_append_sheet(workbook, groupSheet, 'Analysis Groups');
      }
      
      // Raw data sheets per file
      files.forEach(file => {
        file.loggers.forEach(logger => {
          const rawData = [
            ['Date', 'Time', 'Temperature (°C)', 'F-Value'],
            ...logger.records.map(r => [
              r.date,
              r.time,
              r.temperature,
              r.fValue ?? '-'
            ])
          ];
          
          const sheetName = `${file.name.replace('.csv', '').substring(0, 20)}_${logger.name}`.substring(0, 31);
          const rawSheet = XLSX.utils.aoa_to_sheet(rawData);
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

      // Chart
      if (chartRef.current) {
        checkNewPage(80);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(59, 130, 246);
        pdf.text("III. TEMPERATURE PROFILE", margin, yPos);
        yPos += 8;

        try {
          const canvas = await html2canvas(chartRef.current, {
            backgroundColor: "#ffffff",
            scale: 2,
          });
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = pageWidth - margin * 2;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          checkNewPage(imgHeight + 10);
          pdf.addImage(imgData, "PNG", margin, yPos, imgWidth, Math.min(imgHeight, 80));
          yPos += Math.min(imgHeight, 80) + 10;
        } catch (error) {
          console.error("Failed to capture chart:", error);
        }
      }

      // Results
      const allResults = getFilteredResults();
      
      checkNewPage(40);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("IV. SESSION ANALYSIS RESULTS", margin, yPos);
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
            `>= ${r.threshold?.toFixed(1)}C`,
            `${r.averageTemp.toFixed(2)}C`,
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
            const fValueLabel = isSterilization ? "F121C" : "F63C";
            return [
              sanitizeForPDF(r.loggerName),
              sanitizeForPDF(r.sessionName),
              `${r.averageTemp.toFixed(2)}C`,
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
          pdf.text("V. CUSTOM ANALYSIS GROUPS", margin, yPos);
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
              `Avg Temp: ${avgTemp.toFixed(2)}C | Avg Duration: ${avgDuration.toFixed(1)} min | Avg F-Value: ${avgFValue.toFixed(2)}`,
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
                `${item.averageTemp.toFixed(2)}C`,
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

      // Notes
      if (settings.validationNotes) {
        checkNewPage(40);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(59, 130, 246);
        const sectionNum = analysisGroups.length > 0 ? "VI" : "V";
        pdf.text(`${sectionNum}. VERIFICATION NOTES`, margin, yPos);
        yPos += 8;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        
        const splitNotes = pdf.splitTextToSize(settings.validationNotes, pageWidth - margin * 2);
        pdf.text(splitNotes, margin, yPos);
      }

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
                  <Badge variant="secondary">온도 그래프</Badge>
                  <Badge variant="secondary">회차별 결과</Badge>
                  <Badge variant="secondary">열수 분석</Badge>
                  <Badge variant="secondary">품온 분석</Badge>
                  {analysisGroups.length > 0 && (
                    <Badge variant="secondary">분석 그룹 ({analysisGroups.length})</Badge>
                  )}
                </div>
              </div>

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
