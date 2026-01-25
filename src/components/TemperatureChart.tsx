import { useMemo, useState } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";

interface TemperatureChartProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
}

export function TemperatureChart({ loggers, sessions }: TemperatureChartProps) {
  const [selectedLoggerId, setSelectedLoggerId] = useState<string>(loggers[0]?.id || '');

  const selectedLogger = useMemo(() => 
    loggers.find(l => l.id === selectedLoggerId) || loggers[0],
    [loggers, selectedLoggerId]
  );

  const chartData = useMemo(() => {
    if (!selectedLogger || selectedLogger.records.length === 0) return [];
    
    // Sample data to avoid too many points (max 500 points)
    const records = selectedLogger.records;
    const step = Math.max(1, Math.floor(records.length / 500));
    
    return records
      .filter((_, idx) => idx % step === 0)
      .map((record) => {
        const session = sessions.find(
          s => record.index >= s.startIndex && record.index <= s.endIndex
        );
        
        return {
          time: record.time,
          temperature: record.temperature,
          fValue: record.fValue,
          session: session?.name || '',
          index: record.index,
        };
      });
  }, [selectedLogger, sessions]);

  const hasFValue = useMemo(() => 
    selectedLogger?.records.some(r => r.fValue !== undefined) || false,
    [selectedLogger]
  );

  const referenceLines = useMemo(() => {
    const lines: { value: number; color: string; label: string }[] = [];
    
    if (selectedLogger?.type === 'hotwater' && selectedLogger.setTemperature) {
      lines.push({
        value: selectedLogger.setTemperature - 2.4,
        color: 'hsl(var(--chart-1))',
        label: `기준 (${(selectedLogger.setTemperature - 2.4).toFixed(1)}℃)`,
      });
    }
    
    if (selectedLogger?.type === 'product') {
      lines.push({
        value: 63,
        color: 'hsl(var(--chart-2))',
        label: '63℃ (살균)',
      });
      lines.push({
        value: 121,
        color: 'hsl(var(--destructive))',
        label: '121℃ (멸균)',
      });
    }
    
    return lines;
  }, [selectedLogger]);

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
            <TrendingUp className="w-4 h-4 text-primary" />
            온도 그래프
          </CardTitle>
          
          {loggers.length > 1 && (
            <Select value={selectedLoggerId} onValueChange={setSelectedLoggerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="데이터로거 선택" />
              </SelectTrigger>
              <SelectContent>
                {loggers.map((logger) => (
                  <SelectItem key={logger.id} value={logger.id}>
                    {logger.name.length > 25 ? `${logger.name.substring(0, 25)}...` : logger.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary">
            {chartData.length.toLocaleString()}개 데이터 포인트
          </Badge>
          {sessions.map((session) => (
            <Badge key={session.id} variant="outline">
              {session.name}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 11 }} 
                interval="preserveStartEnd"
              />
              <YAxis 
                yAxisId="temp"
                domain={['auto', 'auto']}
                tick={{ fontSize: 11 }}
                label={{ value: '온도 (℃)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              {hasFValue && (
                <YAxis 
                  yAxisId="fvalue"
                  orientation="right"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'F Value', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
                />
              )}
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              
              {referenceLines.map((line, idx) => (
                <ReferenceLine 
                  key={idx}
                  y={line.value} 
                  yAxisId="temp"
                  stroke={line.color} 
                  strokeDasharray="5 5"
                  label={{ 
                    value: line.label, 
                    position: 'right',
                    style: { fontSize: 10, fill: line.color }
                  }}
                />
              ))}
              
              <Line 
                yAxisId="temp"
                type="monotone" 
                dataKey="temperature" 
                name="온도" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
              />
              
              {hasFValue && (
                <Line 
                  yAxisId="fvalue"
                  type="monotone" 
                  dataKey="fValue" 
                  name="F Value" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--chart-3))' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
