import { useMemo, useState } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
}

const ROWS_PER_PAGE = 50;

export function DataTable({ loggers, sessions }: DataTableProps) {
  const [selectedLoggerId, setSelectedLoggerId] = useState<string>(loggers[0]?.id || '');
  const [currentPage, setCurrentPage] = useState(1);

  const selectedLogger = useMemo(() => 
    loggers.find(l => l.id === selectedLoggerId) || loggers[0],
    [loggers, selectedLoggerId]
  );

  const paginatedRecords = useMemo(() => {
    if (!selectedLogger) return [];
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return selectedLogger.records.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [selectedLogger, currentPage]);

  const totalPages = useMemo(() => {
    if (!selectedLogger) return 0;
    return Math.ceil(selectedLogger.records.length / ROWS_PER_PAGE);
  }, [selectedLogger]);

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

  if (!selectedLogger || selectedLogger.records.length === 0) {
    return (
      <Card className="bg-card">
        <CardContent className="py-8 text-center text-muted-foreground">
          표시할 데이터가 없습니다
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-primary" />
            원본 데이터
          </CardTitle>
          
          {loggers.length > 1 && (
            <Select value={selectedLoggerId} onValueChange={(v) => { setSelectedLoggerId(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="데이터로거 선택" />
              </SelectTrigger>
              <SelectContent>
                {loggers.map((logger) => (
                  <SelectItem key={logger.id} value={logger.id}>
                    {logger.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="outline">
            총 {selectedLogger.records.length.toLocaleString()}개 레코드
          </Badge>
          {selectedLogger.type && (
            <Badge variant="secondary">
              {selectedLogger.type === 'hotwater' ? '열수 측정' : '품온 측정'}
            </Badge>
          )}
          {selectedLogger.type === 'hotwater' && selectedLogger.setTemperature && (
            <Badge className="bg-chart-1/20 text-foreground border-chart-1/30">
              ≥ {(selectedLogger.setTemperature - 2.4).toFixed(1)}℃ 강조
            </Badge>
          )}
          {selectedLogger.type === 'product' && (
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
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead className="w-24">회차</TableHead>
                <TableHead>날짜</TableHead>
                <TableHead>시간</TableHead>
                <TableHead className="text-right">온도 (℃)</TableHead>
                {selectedLogger.records.some(r => r.fValue !== undefined) && (
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
                    className={cn(getRowHighlight(record.temperature, selectedLogger))}
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
                    {selectedLogger.records.some(r => r.fValue !== undefined) && (
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
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
