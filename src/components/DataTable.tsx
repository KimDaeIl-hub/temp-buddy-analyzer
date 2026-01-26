import * as React from "react";
import { useMemo } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
}

const LOGGER_COLORS = [
  { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-600', highlight: 'bg-sky-500/20' },
  { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-600', highlight: 'bg-green-500/20' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600', highlight: 'bg-orange-500/20' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-600', highlight: 'bg-purple-500/20' },
];

export function DataTable({ loggers, sessions }: DataTableProps) {
  // Calculate column count for each logger
  const loggerColumnCounts = useMemo(() => {
    return loggers.map(logger => {
      const hasFValue = logger.records.some(r => r.fValue !== undefined);
      return hasFValue ? 4 : 3; // 날짜, 시간, 온도, (F value)
    });
  }, [loggers]);

  // Merge all logger data by index to create a horizontal table
  const mergedData = useMemo(() => {
    const maxRecords = Math.max(...loggers.map(l => l.records.length));
    const rows: Array<{
      index: number;
      loggerData: Array<{
        logger: DataLogger;
        record: typeof loggers[0]['records'][0] | null;
        colorIdx: number;
        hasFValue: boolean;
      }>;
    }> = [];

    for (let i = 0; i < maxRecords; i++) {
      rows.push({
        index: i,
        loggerData: loggers.map((logger, colorIdx) => ({
          logger,
          record: logger.records[i] || null,
          colorIdx,
          hasFValue: logger.records.some(r => r.fValue !== undefined),
        })),
      });
    }

    return rows;
  }, [loggers]);

  const getRowHighlight = (temperature: number, logger: DataLogger, colorIdx: number): string => {
    if (!logger.type) return '';
    
    if (logger.type === 'hotwater' && logger.setTemperature) {
      const threshold = logger.setTemperature - 2.4;
      if (temperature >= threshold) {
        return LOGGER_COLORS[colorIdx % LOGGER_COLORS.length].highlight;
      }
    }
    
    if (logger.type === 'product') {
      if (temperature >= 121) {
        return 'bg-destructive/30';
      }
      if (temperature >= 63) {
        return LOGGER_COLORS[colorIdx % LOGGER_COLORS.length].highlight;
      }
    }
    
    return '';
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
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-primary" />
            원본 데이터 (전체 로거)
          </CardTitle>
          <Badge variant="outline">{loggers.length}개 로거</Badge>
        </div>
        
        {/* Logger legend with threshold info */}
        <div className="flex flex-wrap gap-2 mt-2">
          {loggers.map((logger, idx) => {
            const colorStyle = LOGGER_COLORS[idx % LOGGER_COLORS.length];
            return (
              <Badge 
                key={logger.id}
                variant="outline"
                className={cn("text-xs", colorStyle.border, colorStyle.text)}
              >
                {logger.name}
                {logger.type === 'hotwater' && logger.setTemperature && (
                  <span className="ml-1 opacity-70">
                    (≥{(logger.setTemperature - 2.4).toFixed(1)}℃ 강조)
                  </span>
                )}
                {logger.type === 'product' && (
                  <span className="ml-1 opacity-70">(≥63℃ 강조)</span>
                )}
              </Badge>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[600px] w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                {/* Logger name row */}
                <TableRow>
                  {loggers.map((logger, idx) => {
                    const colorStyle = LOGGER_COLORS[idx % LOGGER_COLORS.length];
                    const colSpan = loggerColumnCounts[idx];
                    
                    return (
                      <TableHead 
                        key={logger.id}
                        colSpan={colSpan}
                        className={cn(
                          "text-center border-r last:border-r-0",
                          colorStyle.bg, colorStyle.text
                        )}
                      >
                        {logger.name}
                      </TableHead>
                    );
                  })}
                </TableRow>
                {/* Column headers row */}
                <TableRow>
                  {loggers.map((logger, idx) => {
                    const hasFValue = logger.records.some(r => r.fValue !== undefined);
                    const isLast = idx === loggers.length - 1;
                    
                    return (
                      <React.Fragment key={`header-${logger.id}`}>
                        <TableHead className="text-center w-20 text-xs border-l first:border-l-0">날짜</TableHead>
                        <TableHead className="text-center w-16 text-xs">시간</TableHead>
                        <TableHead className={cn("text-right w-16 text-xs", !hasFValue && !isLast && "border-r")}>온도(℃)</TableHead>
                        {hasFValue && (
                          <TableHead className={cn("text-right w-16 text-xs", !isLast && "border-r")}>F value</TableHead>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mergedData.map((row) => (
                  <TableRow key={row.index}>
                    {row.loggerData.map(({ logger, record, colorIdx, hasFValue }, loggerIdx) => {
                      const isLast = loggerIdx === loggers.length - 1;
                      const highlightClass = record 
                        ? getRowHighlight(record.temperature, logger, colorIdx) 
                        : '';
                      
                      if (!record) {
                        return (
                          <React.Fragment key={`empty-${logger.id}-${row.index}`}>
                            <TableCell className="text-center text-muted-foreground text-xs border-l first:border-l-0">-</TableCell>
                            <TableCell className="text-center text-muted-foreground text-xs">-</TableCell>
                            <TableCell className={cn("text-right text-muted-foreground text-xs", !hasFValue && !isLast && "border-r")}>-</TableCell>
                            {hasFValue && <TableCell className={cn("text-right text-xs", !isLast && "border-r")}>-</TableCell>}
                          </React.Fragment>
                        );
                      }
                      
                      return (
                        <React.Fragment key={`data-${logger.id}-${row.index}`}>
                          <TableCell className={cn("text-center font-mono text-xs border-l first:border-l-0 py-1", highlightClass)}>
                            {record.date}
                          </TableCell>
                          <TableCell className={cn("text-center font-mono text-xs py-1", highlightClass)}>
                            {record.time}
                          </TableCell>
                          <TableCell className={cn("text-right font-mono text-xs py-1", highlightClass, !hasFValue && !isLast && "border-r")}>
                            {record.temperature.toFixed(2)}
                          </TableCell>
                          {hasFValue && (
                            <TableCell className={cn("text-right font-mono text-xs py-1", highlightClass, !isLast && "border-r")}>
                              {record.fValue?.toFixed(2) || ''}
                            </TableCell>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
