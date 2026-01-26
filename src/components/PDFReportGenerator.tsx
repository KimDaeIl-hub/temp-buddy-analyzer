import { useState } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { calculateSessionResults } from "@/utils/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, Settings2, CheckCircle2 } from "lucide-react";
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

interface PDFReportGeneratorProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
  chartRef: React.RefObject<HTMLDivElement>;
}

interface ReportSettings {
  productName: string;
  operatorName: string;
  facilityName: string;
  validationNotes: string;
}

export function PDFReportGenerator({ loggers, sessions, chartRef }: PDFReportGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<ReportSettings>({
    productName: "",
    operatorName: "",
    facilityName: "",
    validationNotes: "",
  });

  const generatePDF = async () => {
    if (sessions.length === 0) {
      alert("회차를 먼저 분할해주세요.");
      return;
    }

    setIsGenerating(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Helper to add new page if needed
      const checkNewPage = (height: number) => {
        if (yPos + height > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Header Section
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("VALIDATION REPORT", margin, 18);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const today = new Date().toLocaleDateString("ko-KR", {
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

      // Executive Summary Section
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("I. EXECUTIVE SUMMARY", margin, yPos);
      yPos += 8;

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      // Summary Cards
      const cardWidth = (pageWidth - margin * 2 - 15) / 4;
      const cardHeight = 25;
      const configuredLoggers = loggers.filter((l) => l.type !== null);
      
      const summaryData = [
        { label: "Total Loggers", value: loggers.length.toString() },
        { label: "Hot Water", value: configuredLoggers.filter((l) => l.type === "hotwater").length.toString() },
        { label: "Product", value: configuredLoggers.filter((l) => l.type === "product").length.toString() },
        { label: "Sessions", value: sessions.length.toString() },
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

      // Product Info Section
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

      // Temperature Chart Section
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

      // Session Results
      checkNewPage(40);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("IV. SESSION ANALYSIS RESULTS", margin, yPos);
      yPos += 8;

      // Calculate results for each logger
      const allResults: ReturnType<typeof calculateSessionResults> = [];
      loggers.forEach((logger) => {
        if (logger.type && sessions.length > 0) {
          const loggerResults = calculateSessionResults(logger, sessions);
          allResults.push(...loggerResults);
        }
      });

      // Hot Water Results Table
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
          head: [["Logger", "Session", "Threshold", "Avg Temp", "Duration", "Records"]],
          body: hotwaterResults.map((r) => [
            r.loggerName,
            r.sessionName,
            `≥ ${r.threshold?.toFixed(1)}°C`,
            `${r.averageTemp.toFixed(2)}°C`,
            `${r.durationMinutes.toFixed(1)} min`,
            r.recordCount.toString(),
          ]),
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [14, 165, 233], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        yPos = (pdf as any).lastAutoTable.finalY + 10;
      }

      // Product Results Table
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
          head: [["Logger", "Session", "Avg Temp (≥63°C)", "Duration", "F-Value"]],
          body: productResults.map((r) => {
            const isSterilization = r.sterilizationType === "sterilization";
            const fValueLabel = isSterilization ? "F121°C" : "F63°C";
            return [
              r.loggerName,
              r.sessionName,
              `${r.averageTemp.toFixed(2)}°C`,
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

      // Validation Notes
      if (settings.validationNotes) {
        checkNewPage(40);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(59, 130, 246);
        pdf.text("V. VERIFICATION NOTES", margin, yPos);
        yPos += 8;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        
        const splitNotes = pdf.splitTextToSize(settings.validationNotes, pageWidth - margin * 2);
        pdf.text(splitNotes, margin, yPos);
      }

      // Footer on all pages
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

      // Save the PDF
      const fileName = settings.productName
        ? `validation_report_${settings.productName.replace(/\s+/g, "_")}.pdf`
        : `validation_report_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);

      setIsOpen(false);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isReady = loggers.length > 0 && sessions.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={!isReady}>
          <FileDown className="w-4 h-4" />
          PDF 리포트
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            PDF 리포트 생성
          </DialogTitle>
          <DialogDescription>
            분석 결과를 PDF 리포트로 내보냅니다
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Settings Panel */}
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
                  placeholder="예: 김치찌개 Batch A"
                  value={settings.productName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, productName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatorName">작업자</Label>
                <Input
                  id="operatorName"
                  placeholder="예: 홍길동"
                  value={settings.operatorName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, operatorName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityName">시설명</Label>
                <Input
                  id="facilityName"
                  placeholder="예: 가공 공장 A동"
                  value={settings.facilityName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, facilityName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">검증 메모</Label>
                <Textarea
                  id="notes"
                  placeholder="추가 메모 사항..."
                  rows={3}
                  value={settings.validationNotes}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, validationNotes: e.target.value }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                리포트 미리보기
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground">ISSUE DATE</div>
                  <div className="text-sm font-medium">
                    {new Date().toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <div className="text-lg font-bold text-primary mb-2">
                  VALIDATION REPORT
                </div>
                {settings.productName && (
                  <div className="text-sm text-muted-foreground">
                    Product: {settings.productName}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  포함 내용
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">온도 그래프</Badge>
                  <Badge variant="secondary">회차별 결과</Badge>
                  <Badge variant="secondary">열수 분석</Badge>
                  <Badge variant="secondary">품온 분석</Badge>
                  {settings.validationNotes && (
                    <Badge variant="secondary">검증 메모</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="text-xs text-muted-foreground">로거</div>
                  <div className="text-xl font-bold text-primary">{loggers.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <div className="text-xs text-muted-foreground">회차</div>
                  <div className="text-xl font-bold text-primary">{sessions.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            취소
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating || !isReady}>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
