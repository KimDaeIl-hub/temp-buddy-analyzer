import { useMemo, useState } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
}

const ROWS_PER_PAGE = 50;

const LOGGER_COLORS = [
  { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600' },
  { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-600' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600' },
];

export function DataTable({ loggers, sessions }: DataTableProps) {
  const [currentPages, setCurrentPages] = useState<Record<string, number>>(() => {
    const pages: Record<string, number> = {};
    loggers.forEach(l => { pages[l.id] = 1; });
    return pages;
  });

  const getRowHighlight = (temperature: number, logger: DataLogger): string => {
    if (!logger.type) return '';
    
    if (logger.type === 'hotwater' && logger.setTemperature) {
      const threshold = logger.setTemperature - 2.4;
      if (temperature >= threshold) {
        return 'bg-chart-1/20 text-foreground';
      }
    }
    
    if (logger.type === 'product') {
      if (temperature >= 121) {
        return 'bg-destructive/20 text-foreground font-medium';
      }
      if (temperature >= 63) {
        return 'bg-chart-2/20 text-foreground';
      }
    }
    
    return '';
  };

  const getSessionForRecord = (timestamp: Date): MeasurementSession | undefined => {
    return sessions.find(s => timestamp >= s.startTime && timestamp <= s.endTime);
  };

  const getPaginatedRecords = (logger: DataLogger, page: number) => {
    const startIndex = (page - 1) * ROWS_PER_PAGE;
    return logger.records.slice(startIndex, startIndex + ROWS_PER_PAGE);
  };

  const getTotalPages = (logger: DataLogger) => {
    return Math.ceil(logger.records.length / ROWS_PER_PAGE);
  };

  const handlePageChange = (loggerId: string, newPage: number) => {
    setCurrentPages(prev => ({ ...prev, [loggerId]: newPage }));
  };

  if (loggers.length === 0 || loggers.every(l => l.records.length === 0)) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          표시할 데이터가 없습니다
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">원본 데이터 (전체 로거)</h2>
        <Badge variant="outline">{loggers.length}개 로거</Badge>
      </div>

      {loggers.map((logger, loggerIdx) => {
        const currentPage = currentPages[logger.id] || 1;
        const totalPages = getTotalPages(logger);
        const paginatedRecords = getPaginatedRecords(logger, currentPage);
        const colorStyle = LOGGER_COLORS[loggerIdx % LOGGER_COLORS.length];
        const hasFValue = logger.records.some(r => r.fValue !== undefined);

        return (
          <Card key={logger.id} className={cn("bg-card", colorStyle.border, "border-l-4")}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className={cn("flex items-center gap-2 text-base", colorStyle.text)}>
                  {logger.name}
                </CardTitle>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    총 {logger.records.length.toLocaleString()}개 레코드
                  </Badge>
                  {logger.type && (
                    <Badge variant="secondary">
                      {logger.type === 'hotwater' ? '열수 측정' : '품온 측정'}
                    </Badge>
                  )}
                  {logger.type === 'hotwater' && logger.setTemperature && (
                    <Badge className="bg-chart-1/20 text-foreground border-chart-1/30">
                      ≥ {(logger.setTemperature - 2.4).toFixed(1)}℃ 강조
                    </Badge>
                  )}
                  {logger.type === 'product' && (
                    <>
                      <Badge className="bg-chart-2/20 text-foreground border-chart-2/30">
                        ≥ 63℃ 강조
                      </Badge>
                      <Badge className="bg-destructive/20 text-foreground border-destructive/30">
                        ≥ 121℃ 강조
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-16 text-center">#</TableHead>
                      <TableHead className="w-24">회차</TableHead>
                      <TableHead>날짜</TableHead>
                      <TableHead>시간</TableHead>
                      <TableHead className="text-right">온도 (℃)</TableHead>
                      {hasFValue && (
                        <TableHead className="text-right">F Value</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record) => {
                      const session = getSessionForRecord(record.timestamp);
                      return (
                        <TableRow 
                          key={record.index}
                          className={cn(getRowHighlight(record.temperature, logger))}
                        >
                          <TableCell className="text-center text-muted-foreground text-sm">
                            {record.index + 1}
                          </TableCell>
                          <TableCell>
                            {session && (
                              <Badge variant="outline" className="text-xs">
                                {session.name}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{record.date}</TableCell>
                          <TableCell className="font-mono text-sm">{record.time}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {record.temperature.toFixed(2)}
                          </TableCell>
                          {hasFValue && (
                            <TableCell className="text-right font-mono text-sm">
                              {record.fValue?.toFixed(4) || '-'}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-sm text-muted-foreground">
                  페이지 {currentPage} / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(logger.id, Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(logger.id, Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
