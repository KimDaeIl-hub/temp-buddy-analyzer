import { useMemo } from "react";
import { DataFile, ResultFilter } from "@/types/file";
import { calculateSessionResults } from "@/utils/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Clock, Droplets, Package } from "lucide-react";

interface ResultsSummaryProps {
  files: DataFile[];
  resultFilters: ResultFilter[];
}

export function ResultsSummary({ files, resultFilters }: ResultsSummaryProps) {
  // Calculate all results from all files
  const allResults = useMemo(() => {
    const results: ReturnType<typeof calculateSessionResults> = [];
    
    files.forEach(file => {
      file.loggers.forEach(logger => {
        if (logger.type && file.sessions.length > 0) {
          const loggerResults = calculateSessionResults(logger, file.sessions);
          // Add file info to each result
          loggerResults.forEach(r => {
            (r as any).fileId = file.id;
            (r as any).fileName = file.name;
          });
          results.push(...loggerResults);
        }
      });
    });
    
    return results;
  }, [files]);

  // Filter results based on resultFilters
  const filteredResults = useMemo(() => {
    if (resultFilters.length === 0) return allResults;
    
    return allResults.filter(result => {
      const filter = resultFilters.find(
        f => f.fileId === (result as any).fileId && 
             f.loggerId === result.loggerId && 
             f.sessionId === result.sessionId
      );
      return filter ? filter.enabled : true;
    });
  }, [allResults, resultFilters]);

  // Get all configured loggers count (filtered)
  const configuredLoggersCount = useMemo(() => {
    const uniqueLoggers = new Set<string>();
    filteredResults.forEach(r => uniqueLoggers.add(`${(r as any).fileId}-${r.loggerId}`));
    return uniqueLoggers.size;
  }, [filteredResults]);

  // Get unique sessions count (filtered)
  const sessionsCount = useMemo(() => {
    const uniqueSessions = new Set<string>();
    filteredResults.forEach(r => uniqueSessions.add(`${(r as any).fileId}-${r.sessionId}`));
    return uniqueSessions.size;
  }, [filteredResults]);

  // Get hotwater and product loggers count (filtered)
  const hotwaterCount = useMemo(() => {
    const unique = new Set<string>();
    filteredResults.filter(r => r.loggerType === 'hotwater').forEach(r => unique.add(`${(r as any).fileId}-${r.loggerId}`));
    return unique.size;
  }, [filteredResults]);

  const productCount = useMemo(() => {
    const unique = new Set<string>();
    filteredResults.filter(r => r.loggerType === 'product').forEach(r => unique.add(`${(r as any).fileId}-${r.loggerId}`));
    return unique.size;
  }, [filteredResults]);

  const totalLoggers = files.reduce((sum, f) => sum + f.loggers.length, 0);

  if (totalLoggers === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          CSV 파일을 업로드하세요
        </CardContent>
      </Card>
    );
  }

  if (configuredLoggersCount === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          데이터로거 유형을 설정하세요 (설정 탭에서 열수/품온 선택)
        </CardContent>
      </Card>
    );
  }

  if (sessionsCount === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          그래프에서 "회차 분할" 버튼을 클릭하여 측정 회차를 추가하세요
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 데이터로거</p>
                <p className="text-2xl font-bold">{configuredLoggersCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-1/20">
                <Droplets className="w-5 h-5 text-chart-1" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">열수 측정</p>
                <p className="text-2xl font-bold">{hotwaterCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-chart-2/20">
                <Package className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">품온 측정</p>
                <p className="text-2xl font-bold">{productCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/20">
                <Clock className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">측정 회차</p>
                <p className="text-2xl font-bold">{sessionsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Water Results */}
      {filteredResults.some(r => r.loggerType === 'hotwater') && (
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="w-4 h-4 text-chart-1" />
              열수 측정 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {files.length > 1 && <TableHead>파일</TableHead>}
                  <TableHead>데이터로거</TableHead>
                  <TableHead>회차</TableHead>
                  <TableHead className="text-right">기준 온도</TableHead>
                  <TableHead className="text-right">평균 온도</TableHead>
                  <TableHead className="text-right">유지 시간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults
                  .filter(r => r.loggerType === 'hotwater')
                  .map((result, idx) => (
                    <TableRow key={`hotwater-${idx}`}>
                      {files.length > 1 && (
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {(result as any).fileName}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {result.loggerName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{result.sessionName}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ≥ {result.threshold?.toFixed(1)}℃
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-chart-1">
                        {result.averageTemp.toFixed(2)}℃
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.durationMinutes.toFixed(1)}분
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Product Temperature Results */}
      {filteredResults.some(r => r.loggerType === 'product') && (
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4 text-chart-2" />
              품온 측정 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {files.length > 1 && <TableHead>파일</TableHead>}
                  <TableHead>데이터로거</TableHead>
                  <TableHead>회차</TableHead>
                  <TableHead className="text-right">평균 온도 (≥63℃)</TableHead>
                  <TableHead className="text-right">유지 시간</TableHead>
                  <TableHead className="text-right">F Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults
                  .filter(r => r.loggerType === 'product')
                  .map((result, idx) => {
                    const isSterilization = result.sterilizationType === 'sterilization';
                    const fValueLabel = isSterilization ? 'F121℃ 이상' : 'F63℃ 이상';
                    
                    return (
                      <TableRow key={`product-${idx}`}>
                        {files.length > 1 && (
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {(result as any).fileName}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="font-medium">
                          {result.loggerName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.sessionName}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-chart-2">
                          {result.averageTemp.toFixed(2)}℃
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {result.durationMinutes.toFixed(1)}분
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">{fValueLabel}</span>
                            <span>{result.sessionFValue?.toFixed(2) || '0.00'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
