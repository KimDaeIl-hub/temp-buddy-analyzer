import { useMemo } from "react";
import { DataLogger, MeasurementSession, CalculationResult } from "@/types/temperature";
import { calculateSessionResults } from "@/utils/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Thermometer, Clock, TrendingUp, Droplets, Package } from "lucide-react";

interface ResultsSummaryProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
}

export function ResultsSummary({ loggers, sessions }: ResultsSummaryProps) {
  const results = useMemo(() => {
    const allResults: CalculationResult[] = [];
    
    loggers.forEach(logger => {
      if (logger.type && sessions.length > 0) {
        const loggerResults = calculateSessionResults(logger, sessions);
        allResults.push(...loggerResults);
      }
    });
    
    return allResults;
  }, [loggers, sessions]);

  const configuredLoggers = loggers.filter(l => l.type !== null);

  if (configuredLoggers.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          데이터로거 유형을 설정하고 측정 회차를 추가하세요
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          측정 회차를 추가하여 분석을 시작하세요
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
                <p className="text-sm text-muted-foreground">총 분석 결과</p>
                <p className="text-2xl font-bold">{results.length}</p>
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
                <p className="text-2xl font-bold">
                  {results.filter(r => r.loggerType === 'hotwater').length}
                </p>
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
                <p className="text-2xl font-bold">
                  {results.filter(r => r.loggerType === 'product').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/20">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">측정 회차</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Water Results */}
      {results.some(r => r.loggerType === 'hotwater') && (
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
                  <TableHead>데이터로거</TableHead>
                  <TableHead>회차</TableHead>
                  <TableHead className="text-right">기준 온도</TableHead>
                  <TableHead className="text-right">평균 온도</TableHead>
                  <TableHead className="text-right">유지 시간</TableHead>
                  <TableHead className="text-right">레코드 수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results
                  .filter(r => r.loggerType === 'hotwater')
                  .map((result, idx) => (
                    <TableRow key={`hotwater-${idx}`}>
                      <TableCell className="font-medium">
                        <span className="truncate block max-w-[150px]" title={result.loggerName}>
                          {result.loggerName.length > 20 
                            ? `${result.loggerName.substring(0, 20)}...` 
                            : result.loggerName}
                        </span>
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
                      <TableCell className="text-right">
                        {result.recordCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Product Temperature Results */}
      {results.some(r => r.loggerType === 'product') && (
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
                  <TableHead>데이터로거</TableHead>
                  <TableHead>회차</TableHead>
                  <TableHead className="text-right">평균 온도 (≥63℃)</TableHead>
                  <TableHead className="text-right">유지 시간</TableHead>
                  <TableHead className="text-right">최대 F Value</TableHead>
                  <TableHead className="text-right">F63℃</TableHead>
                  <TableHead className="text-right">F121℃</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results
                  .filter(r => r.loggerType === 'product')
                  .map((result, idx) => (
                    <TableRow key={`product-${idx}`}>
                      <TableCell className="font-medium">
                        <span className="truncate block max-w-[150px]" title={result.loggerName}>
                          {result.loggerName.length > 20 
                            ? `${result.loggerName.substring(0, 20)}...` 
                            : result.loggerName}
                        </span>
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
                        {result.maxFValue.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.f63Minutes?.toFixed(1) || '-'}분
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.f121Minutes?.toFixed(1) || '-'}분
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
