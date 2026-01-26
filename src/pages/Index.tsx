import { useState, useCallback, useRef, useMemo } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { AnalysisGroup } from "@/types/analysis";
import { DataFile, FileViewMode, ResultFilter as ResultFilterType } from "@/types/file";
import { parseCSVContent } from "@/utils/csvParser";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { FileViewToggle } from "@/components/FileViewToggle";
import { LoggerConfig } from "@/components/LoggerConfig";
import { SessionManager } from "@/components/SessionManager";
import { DataTable } from "@/components/DataTable";
import { ResultsSummary } from "@/components/ResultsSummary";
import { TemperatureChart, TemperatureChartRef } from "@/components/TemperatureChart";
import { PDFReportGenerator } from "@/components/PDFReportGenerator";
import { AnalysisTab } from "@/components/AnalysisTab";
import { ResultFilter } from "@/components/ResultFilter";
import { ExportGenerator } from "@/components/ExportGenerator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Thermometer, RefreshCw, Database, BarChart3, TrendingUp, FileDown, Calculator, FileText } from "lucide-react";

const Index = () => {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [analysisGroups, setAnalysisGroups] = useState<AnalysisGroup[]>([]);
  const [activeTab, setActiveTab] = useState("chart");
  const [viewMode, setViewMode] = useState<FileViewMode>({ mode: 'combined' });
  const [resultFilters, setResultFilters] = useState<ResultFilterType[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const chartComponentRef = useRef<TemperatureChartRef>(null);

  // Get combined loggers and sessions based on view mode
  const { displayLoggers, displaySessions, currentFile } = useMemo(() => {
    if (files.length === 0) {
      return { displayLoggers: [], displaySessions: [], currentFile: null };
    }

    if (viewMode.mode === 'individual' && viewMode.selectedFileId) {
      const file = files.find(f => f.id === viewMode.selectedFileId);
      if (file) {
        return { 
          displayLoggers: file.loggers, 
          displaySessions: file.sessions,
          currentFile: file
        };
      }
    }

    // Combined mode - merge all files
    const allLoggers: DataLogger[] = [];
    const allSessions: MeasurementSession[] = [];
    
    files.forEach((file, fileIndex) => {
      file.loggers.forEach(logger => {
        allLoggers.push({
          ...logger,
          id: `${file.id}-${logger.id}`,
          name: files.length > 1 ? `[${file.name.replace('.csv', '')}] ${logger.name}` : logger.name,
        });
      });
      
      file.sessions.forEach(session => {
        allSessions.push({
          ...session,
          id: session.id + fileIndex * 1000, // Offset to avoid ID collision
          name: files.length > 1 ? `[${file.name.replace('.csv', '')}] ${session.name}` : session.name,
        });
      });
    });

    return { displayLoggers: allLoggers, displaySessions: allSessions, currentFile: null };
  }, [files, viewMode]);

  // For chart editing (when in individual mode, use current file's data)
  const editableFile = useMemo(() => {
    if (viewMode.mode === 'individual' && viewMode.selectedFileId) {
      return files.find(f => f.id === viewMode.selectedFileId) || null;
    }
    // In combined mode, use the first file or the one set as active for editing
    if (activeFileId) {
      return files.find(f => f.id === activeFileId) || files[0] || null;
    }
    return files[0] || null;
  }, [files, viewMode, activeFileId]);

  const handleUpdateLogger = useCallback((loggerId: string, updates: Partial<DataLogger>) => {
    setFiles(prev => prev.map(file => ({
      ...file,
      loggers: file.loggers.map(l => {
        // Handle both prefixed and non-prefixed IDs
        const matchId = loggerId.includes(file.id) 
          ? loggerId.replace(`${file.id}-`, '')
          : loggerId;
        return l.id === matchId || l.id === loggerId ? { ...l, ...updates } : l;
      })
    })));
  }, []);

  const handleUpdateSession = useCallback((sessionId: number, updates: Partial<MeasurementSession>) => {
    setFiles(prev => prev.map(file => ({
      ...file,
      sessions: file.sessions.map(s => 
        s.id === sessionId || s.id === sessionId % 1000 ? { ...s, ...updates } : s
      )
    })));
  }, []);

  const handleSessionsChange = useCallback((sessions: MeasurementSession[], fileId?: string) => {
    const targetFileId = fileId || (viewMode.mode === 'individual' ? viewMode.selectedFileId : files[0]?.id);
    
    setFiles(prev => prev.map(file => 
      file.id === targetFileId ? { ...file, sessions } : file
    ));
  }, [viewMode, files]);

  const handleReset = useCallback(() => {
    setFiles([]);
    setAnalysisGroups([]);
    setResultFilters([]);
    setActiveTab("chart");
    setViewMode({ mode: 'combined' });
    setActiveFileId(null);
  }, []);

  // Get all loggers and sessions from all files for analysis
  const allLoggersForAnalysis = useMemo(() => {
    const result: { logger: DataLogger; fileId: string; fileName: string }[] = [];
    files.forEach(file => {
      file.loggers.forEach(logger => {
        result.push({ logger, fileId: file.id, fileName: file.name });
      });
    });
    return result;
  }, [files]);

  const allSessionsForAnalysis = useMemo(() => {
    const result: { session: MeasurementSession; fileId: string; fileName: string }[] = [];
    files.forEach(file => {
      file.sessions.forEach(session => {
        result.push({ session, fileId: file.id, fileName: file.name });
      });
    });
    return result;
  }, [files]);

  const totalLoggers = files.reduce((sum, f) => sum + f.loggers.length, 0);
  const totalSessions = files.reduce((sum, f) => sum + f.sessions.length, 0);

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
          
          {files.length > 0 && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="hidden sm:flex">
                {files.length}개 파일 · {totalLoggers}개 로거 · {totalSessions}개 회차
              </Badge>
              <ExportGenerator
                files={files}
                analysisGroups={analysisGroups}
                resultFilters={resultFilters}
                chartRef={chartComponentRef?.current?.chartRef || { current: null }}
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
        {files.length === 0 ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                데이터 로거 분석 시작
              </h2>
              <p className="text-muted-foreground">
                TMI QLever에서 내보낸 CSV 파일을 업로드하여 온도 데이터를 분석하세요
              </p>
            </div>
            
            <MultiFileUpload files={files} onFilesChange={setFiles} />
            
            <div className="grid gap-4 md:grid-cols-3 mt-8">
              <div className="p-4 rounded-lg border bg-card text-center">
                <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1">다중 파일 지원</h3>
                <p className="text-sm text-muted-foreground">여러 파일 동시 분석</p>
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
                <h3 className="font-medium mb-1">PDF/Excel 리포트</h3>
                <p className="text-sm text-muted-foreground">분석 결과 내보내기</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-3">
              {/* File View Toggle */}
              {files.length > 1 && (
                <div className="mb-4 flex items-center gap-4">
                  <FileViewToggle
                    files={files}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                  
                  {viewMode.mode === 'combined' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">회차 편집 파일:</span>
                      <Select
                        value={activeFileId || files[0]?.id}
                        onValueChange={setActiveFileId}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue placeholder="파일 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {files.map((file) => (
                            <SelectItem key={file.id} value={file.id}>
                              {file.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
                  <TabsTrigger value="results" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">결과</span>
                  </TabsTrigger>
                  <TabsTrigger value="export" className="gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">내보내기</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="space-y-6">
                  <TemperatureChart 
                    ref={chartComponentRef}
                    loggers={displayLoggers} 
                    sessions={displaySessions}
                    onSessionsChange={(sessions) => handleSessionsChange(sessions, editableFile?.id)}
                  />
                  <LoggerConfig 
                    loggers={displayLoggers} 
                    sessions={displaySessions}
                    onUpdateLogger={handleUpdateLogger} 
                    onUpdateSession={handleUpdateSession}
                  />
                </TabsContent>

                <TabsContent value="data">
                  <DataTable loggers={displayLoggers} sessions={displaySessions} />
                </TabsContent>

                <TabsContent value="analysis">
                  <AnalysisTab
                    files={files}
                    analysisGroups={analysisGroups}
                    onAnalysisGroupsChange={setAnalysisGroups}
                  />
                </TabsContent>

                <TabsContent value="results" className="space-y-6">
                  <ResultFilter
                    files={files}
                    filters={resultFilters}
                    onFiltersChange={setResultFilters}
                  />
                  <ResultsSummary 
                    files={files} 
                    resultFilters={resultFilters}
                  />
                </TabsContent>

                <TabsContent value="export" className="space-y-6">
                  <ResultFilter
                    files={files}
                    filters={resultFilters}
                    onFiltersChange={setResultFilters}
                  />
                  <ExportGenerator
                    files={files}
                    analysisGroups={analysisGroups}
                    resultFilters={resultFilters}
                    chartRef={chartComponentRef?.current?.chartRef || { current: null }}
                    inline
                  />
                </TabsContent>
              </Tabs>
            </div>
            
            <div className="lg:col-span-1 space-y-4">
              {/* File list with session managers */}
              {files.map(file => (
                <div key={file.id} className="space-y-2">
                  {files.length > 1 && (
                    <Badge variant="outline" className="w-full justify-start gap-2">
                      <FileText className="w-3 h-3" />
                      {file.name}
                    </Badge>
                  )}
                  <SessionManager 
                    sessions={file.sessions}
                    onSessionsChange={(sessions) => handleSessionsChange(sessions, file.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
