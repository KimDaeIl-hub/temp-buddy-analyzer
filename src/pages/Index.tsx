import { useState, useCallback } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { parseCSVContent } from "@/utils/csvParser";
import { FileUpload } from "@/components/FileUpload";
import { LoggerConfig } from "@/components/LoggerConfig";
import { SessionManager } from "@/components/SessionManager";
import { DataTable } from "@/components/DataTable";
import { ResultsSummary } from "@/components/ResultsSummary";
import { TemperatureChart } from "@/components/TemperatureChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Upload, RefreshCw, Settings, Database, BarChart3, TrendingUp } from "lucide-react";

const Index = () => {
  const [loggers, setLoggers] = useState<DataLogger[]>([]);
  const [sessions, setSessions] = useState<MeasurementSession[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [activeTab, setActiveTab] = useState("config");

  const handleFileLoad = useCallback((content: string, name: string) => {
    const parsedLoggers = parseCSVContent(content);
    setLoggers(parsedLoggers);
    setSessions([]);
    setFileName(name);
    setActiveTab("config");
  }, []);

  const handleUpdateLogger = useCallback((loggerId: string, updates: Partial<DataLogger>) => {
    setLoggers(prev => 
      prev.map(l => l.id === loggerId ? { ...l, ...updates } : l)
    );
  }, []);

  const handleReset = useCallback(() => {
    setLoggers([]);
    setSessions([]);
    setFileName("");
    setActiveTab("config");
  }, []);

  const allRecords = loggers.flatMap(l => l.records);
  const hasConfiguredLoggers = loggers.some(l => l.type !== null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Thermometer className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Temperature Logger Analyzer</h1>
              <p className="text-xs text-muted-foreground">TMI QLever 데이터 분석 도구</p>
            </div>
          </div>
          
          {fileName && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="hidden sm:flex">
                {fileName}
              </Badge>
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
                데이터 로거 분석 시작하기
              </h2>
              <p className="text-muted-foreground">
                TMI QLever에서 추출한 CSV 파일을 업로드하여 온도 데이터를 분석하세요
              </p>
            </div>
            
            <FileUpload onFileLoad={handleFileLoad} />
            
            <div className="grid gap-4 md:grid-cols-3 mt-8">
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-chart-1/20 w-fit mx-auto mb-3">
                  <Settings className="w-5 h-5 text-chart-1" />
                </div>
                <h3 className="font-medium mb-1">데이터로거 설정</h3>
                <p className="text-sm text-muted-foreground">열수/품온 측정 유형 구분</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-chart-2/20 w-fit mx-auto mb-3">
                  <BarChart3 className="w-5 h-5 text-chart-2" />
                </div>
                <h3 className="font-medium mb-1">자동 계산</h3>
                <p className="text-sm text-muted-foreground">평균 온도, F Value 분석</p>
              </div>
              
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-primary/20 w-fit mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">시각화</h3>
                <p className="text-sm text-muted-foreground">그래프 및 테이블 제공</p>
              </div>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="config" className="gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">설정</span>
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2">
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">원본 데이터</span>
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">분석 결과</span>
              </TabsTrigger>
              <TabsTrigger value="chart" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">그래프</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-primary" />
                    데이터로거 설정
                  </h2>
                  <LoggerConfig loggers={loggers} onUpdateLogger={handleUpdateLogger} />
                </div>
                <div>
                  <SessionManager 
                    records={allRecords}
                    sessions={sessions}
                    onSessionsChange={setSessions}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="data">
              <DataTable loggers={loggers} sessions={sessions} />
            </TabsContent>

            <TabsContent value="summary">
              <ResultsSummary loggers={loggers} sessions={sessions} />
            </TabsContent>

            <TabsContent value="chart">
              <TemperatureChart loggers={loggers} sessions={sessions} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Index;
