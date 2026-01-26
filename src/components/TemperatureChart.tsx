import { useMemo, useState, useCallback } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, ReferenceArea, Brush
} from "recharts";
import { TrendingUp, Scissors, Trash2, Check, MousePointer } from "lucide-react";
import { formatDateTime } from "@/utils/csvParser";

interface TemperatureChartProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
  onSessionsChange: (sessions: MeasurementSession[]) => void;
}

const LOGGER_COLORS = [
  '#0ea5e9', // sky-500
  '#22c55e', // green-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
  '#ef4444', // red-500
];

export function TemperatureChart({ loggers, sessions, onSessionsChange }: TemperatureChartProps) {
  const [isSelectingSession, setIsSelectingSession] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState("");

  // Use first logger as primary timeline (all loggers should have same timestamps)
  const primaryLogger = loggers[0];

  // Build chart data - merge all loggers by timestamp
  const chartData = useMemo(() => {
    if (!primaryLogger || primaryLogger.records.length === 0) return [];
    
    // Sample data to avoid too many points (max 500 points)
    const step = Math.max(1, Math.floor(primaryLogger.records.length / 500));
    
    return primaryLogger.records
      .filter((_, idx) => idx % step === 0)
      .map((record) => {
        const dataPoint: Record<string, any> = {
          time: record.time,
          timestamp: record.timestamp.getTime(),
          index: record.index,
          fullTime: formatDateTime(record.timestamp),
        };
        
        // Add temperature from all loggers (match by time)
        loggers.forEach((logger, loggerIdx) => {
          // Find matching record by similar timestamp
          const matchingRecord = logger.records.find(
            r => Math.abs(r.timestamp.getTime() - record.timestamp.getTime()) < 10000
          );
          
          if (matchingRecord) {
            dataPoint[`temp_${loggerIdx}`] = matchingRecord.temperature;
            if (matchingRecord.fValue !== undefined) {
              dataPoint[`fvalue_${loggerIdx}`] = matchingRecord.fValue;
            }
          }
        });
        
        return dataPoint;
      });
  }, [loggers, primaryLogger]);

  const hasFValue = useMemo(() => 
    loggers.some(logger => logger.records.some(r => r.fValue !== undefined)),
    [loggers]
  );

  const handleChartMouseDown = useCallback((e: any) => {
    if (!isSelectingSession) return;
    if (e && e.activePayload && e.activePayload[0]) {
      const timestamp = e.activePayload[0].payload.timestamp;
      setSelectionStart(timestamp);
      setSelectionEnd(null);
    }
  }, [isSelectingSession]);

  const handleChartMouseMove = useCallback((e: any) => {
    if (!isSelectingSession || selectionStart === null) return;
    if (e && e.activePayload && e.activePayload[0]) {
      const timestamp = e.activePayload[0].payload.timestamp;
      setSelectionEnd(timestamp);
    }
  }, [isSelectingSession, selectionStart]);

  const handleChartMouseUp = useCallback(() => {
    // Selection complete - ready for confirmation
  }, []);

  const confirmSession = useCallback(() => {
    if (selectionStart === null || selectionEnd === null) return;
    
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    const newSession: MeasurementSession = {
      id: sessions.length + 1,
      name: newSessionName || `${sessions.length + 1}차 측정`,
      startTime: new Date(start),
      endTime: new Date(end),
    };
    
    onSessionsChange([...sessions, newSession]);
    setIsSelectingSession(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSessionName("");
  }, [selectionStart, selectionEnd, sessions, newSessionName, onSessionsChange]);

  const cancelSelection = useCallback(() => {
    setIsSelectingSession(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSessionName("");
  }, []);

  const removeSession = useCallback((sessionId: number) => {
    const filtered = sessions.filter(s => s.id !== sessionId);
    const renumbered = filtered.map((s, idx) => ({
      ...s,
      id: idx + 1,
      name: s.name.includes('차 측정') ? `${idx + 1}차 측정` : s.name,
    }));
    onSessionsChange(renumbered);
  }, [sessions, onSessionsChange]);

  const getSessionColor = (index: number) => {
    const colors = [
      'rgba(59, 130, 246, 0.15)', 
      'rgba(16, 185, 129, 0.15)', 
      'rgba(245, 158, 11, 0.15)', 
      'rgba(239, 68, 68, 0.15)',
      'rgba(168, 85, 247, 0.15)'
    ];
    return colors[index % colors.length];
  };

  // Find chart data point closest to a timestamp
  const findChartTimeForTimestamp = (ts: number) => {
    const point = chartData.find(d => d.timestamp >= ts);
    return point?.time || chartData[chartData.length - 1]?.time;
  };

  if (loggers.length === 0 || chartData.length === 0) {
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-primary" />
              온도 그래프 ({loggers.length}개 로거)
            </CardTitle>
            
            <div className="flex items-center gap-2 flex-wrap">
              {!isSelectingSession ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsSelectingSession(true)}
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  회차 분할
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="회차 이름"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="h-8 w-28"
                  />
                  <Button 
                    size="sm" 
                    onClick={confirmSession}
                    disabled={selectionStart === null || selectionEnd === null}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    확인
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelSelection}>
                    취소
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {isSelectingSession && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-primary" />
                <p className="text-sm text-primary">
                  {selectionStart === null 
                    ? "그래프 위에서 드래그하여 구간을 선택하세요" 
                    : selectionEnd === null
                      ? "드래그 중..."
                      : `✅ 선택됨: ${new Date(Math.min(selectionStart, selectionEnd)).toLocaleTimeString()} ~ ${new Date(Math.max(selectionStart, selectionEnd)).toLocaleTimeString()}`
                  }
                </p>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            {loggers.map((logger, idx) => (
              <Badge 
                key={logger.id} 
                variant="outline"
                style={{ 
                  borderColor: LOGGER_COLORS[idx % LOGGER_COLORS.length], 
                  color: LOGGER_COLORS[idx % LOGGER_COLORS.length],
                  backgroundColor: `${LOGGER_COLORS[idx % LOGGER_COLORS.length]}15`
                }}
              >
                {logger.name}
                {logger.records.some(r => r.fValue !== undefined) && ' (F값)'}
              </Badge>
            ))}
          </div>
          
          {sessions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Label className="text-sm text-muted-foreground self-center">측정 회차:</Label>
              {sessions.map((session) => (
                <Badge 
                  key={session.id} 
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {session.name}
                  <button 
                    onClick={() => removeSession(session.id)}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full" style={{ cursor: isSelectingSession ? 'crosshair' : 'default' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onMouseDown={handleChartMouseDown}
              onMouseMove={handleChartMouseMove}
              onMouseUp={handleChartMouseUp}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10 }} 
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
                labelFormatter={(_, payload) => payload[0]?.payload?.fullTime || ''}
              />
              <Legend />
              
              {/* Session reference areas */}
              {sessions.map((session, idx) => (
                <ReferenceArea
                  key={session.id}
                  yAxisId="temp"
                  x1={findChartTimeForTimestamp(session.startTime.getTime())}
                  x2={findChartTimeForTimestamp(session.endTime.getTime())}
                  fill={getSessionColor(idx)}
                  label={{ 
                    value: session.name, 
                    position: 'insideTop',
                    style: { fontSize: 11, fontWeight: 500 }
                  }}
                />
              ))}
              
              {/* Current selection area */}
              {isSelectingSession && selectionStart !== null && selectionEnd !== null && (
                <ReferenceArea
                  yAxisId="temp"
                  x1={findChartTimeForTimestamp(Math.min(selectionStart, selectionEnd))}
                  x2={findChartTimeForTimestamp(Math.max(selectionStart, selectionEnd))}
                  fill="rgba(59, 130, 246, 0.3)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              )}
              
              {/* Reference lines for thresholds */}
              <ReferenceLine 
                y={63} 
                yAxisId="temp"
                stroke="#22c55e" 
                strokeDasharray="5 5"
                label={{ 
                  value: '63℃', 
                  position: 'right',
                  style: { fontSize: 10, fill: '#22c55e' }
                }}
              />
              
              {/* Temperature lines for each logger */}
              {loggers.map((logger, idx) => (
                <Line 
                  key={`temp-${logger.id}`}
                  yAxisId="temp"
                  type="monotone" 
                  dataKey={`temp_${idx}`} 
                  name={`${logger.name}`}
                  stroke={LOGGER_COLORS[idx % LOGGER_COLORS.length]} 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              ))}
              
              {/* F-value lines for loggers that have it */}
              {hasFValue && loggers.map((logger, idx) => {
                const hasLoggerFValue = logger.records.some(r => r.fValue !== undefined);
                if (!hasLoggerFValue) return null;
                return (
                  <Line 
                    key={`fvalue-${logger.id}`}
                    yAxisId="fvalue"
                    type="monotone" 
                    dataKey={`fvalue_${idx}`} 
                    name={`${logger.name} F값`}
                    stroke={LOGGER_COLORS[idx % LOGGER_COLORS.length]} 
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                );
              })}
              
              <Brush 
                dataKey="time" 
                height={30} 
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
