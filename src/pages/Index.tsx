import { useState, useCallback, useRef } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { AnalysisGroup } from "@/types/analysis";
import { parseCSVContent } from "@/utils/csvParser";
import { FileUpload } from "@/components/FileUpload";
import { LoggerConfig } from "@/components/LoggerConfig";
import { SessionManager } from "@/components/SessionManager";
import { DataTable } from "@/components/DataTable";
import { ResultsSummary } from "@/components/ResultsSummary";
import { TemperatureChart, TemperatureChartRef } from "@/components/TemperatureChart";
import { PDFReportGenerator } from "@/components/PDFReportGenerator";
import { AnalysisTab } from "@/components/AnalysisTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Thermometer, RefreshCw, Database, BarChart3, TrendingUp, FileDown, Calculator } from "lucide-react";

const Index = () => {
  const [loggers, setLoggers] = useState<DataLogger[]>([]);
  const [sessions, setSessions] = useState<MeasurementSession[]>([]);
  const [analysisGroups, setAnalysisGroups] = useState<AnalysisGroup[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [activeTab, setActiveTab] = useState("chart");
  const chartComponentRef = useRef<TemperatureChartRef>(null);

  const handleFileLoad = useCallback((content: string, name: string) => {
    const parsedLoggers = parseCSVContent(content);
    setLoggers(parsedLoggers);
    setSessions([]);
    setAnalysisGroups([]);
    setFileName(name);
    setActiveTab("chart");
  }, []);

  const handleUpdateLogger = useCallback((loggerId: string, updates: Partial<DataLogger>) => {
    setLoggers(prev => 
      prev.map(l => l.id === loggerId ? { ...l, ...updates } : l)
    );
  }, []);

  const handleUpdateSession = useCallback((sessionId: number, updates: Partial<MeasurementSession>) => {
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    );
  }, []);

  const handleReset = useCallback(() => {
    setLoggers([]);
    setSessions([]);
    setAnalysisGroups([]);
    setFileName("");
    setActiveTab("chart");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Thermometer className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">온도 데이터로거 분석기</h1>
              <p className="text-xs text-muted-foreground">TMI QLever 데이터 분석 도구</p>
            </div>
          </div>
          
          {fileName && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="hidden sm:flex">
                {fileName} ({loggers.length} loggers)
              </Badge>
              <PDFReportGenerator 
                loggers={loggers}
                sessions={sessions}
                chartRef={chartComponentRef?.current?.chartRef || { current: null }}
                analysisGroups={analysisGroups}
              />
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="w-4 h-4 mr-2" />
                새 파일
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container px-4 py-6">
        {loggers.length === 0 ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                데이터 로거 분석 시작
              </h2>
              <p className="text-muted-foreground">
                TMI QLever에서 내보낸 CSV 파일을 업로드하여 온도 데이터를 분석하세요
              </p>
            </div>
            
            <FileUpload onFileLoad={handleFileLoad} />
            
            <div className="grid gap-4 md:grid-cols-3 mt-8">
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">다중 로거 지원</h3>
                <p className="text-sm text-muted-foreground">4개 로거 동시 분석</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">회차 분할</h3>
                <p className="text-sm text-muted-foreground">직관적인 구간 선택</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3">
                  <FileDown className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">PDF 리포트</h3>
                <p className="text-sm text-muted-foreground">분석 결과 내보내기</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                  <TabsTrigger value="chart" className="gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="hidden sm:inline">그래프/설정</span>
                  </TabsTrigger>
                  <TabsTrigger value="data" className="gap-2">
                    <Database className="w-4 h-4" />
                    <span className="hidden sm:inline">데이터</span>
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="gap-2">
                    <Calculator className="w-4 h-4" />
                    <span className="hidden sm:inline">분석</span>
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">결과</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="space-y-6">
                  <TemperatureChart 
                    ref={chartComponentRef}
                    loggers={loggers} 
                    sessions={sessions}
                    onSessionsChange={setSessions}
                  />
                  <LoggerConfig 
                    loggers={loggers} 
                    sessions={sessions}
                    onUpdateLogger={handleUpdateLogger} 
                    onUpdateSession={handleUpdateSession}
                  />
                </TabsContent>

                <TabsContent value="data">
                  <DataTable loggers={loggers} sessions={sessions} />
                </TabsContent>

                <TabsContent value="analysis">
                  <AnalysisTab
                    loggers={loggers}
                    sessions={sessions}
                    analysisGroups={analysisGroups}
                    onAnalysisGroupsChange={setAnalysisGroups}
                  />
                </TabsContent>

                <TabsContent value="summary">
                  <ResultsSummary loggers={loggers} sessions={sessions} />
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="lg:col-span-1">
              <SessionManager 
                sessions={sessions}
                onSessionsChange={setSessions}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
