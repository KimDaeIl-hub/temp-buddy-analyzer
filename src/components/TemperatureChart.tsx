import { useMemo, useState, useCallback, useRef } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from "recharts";
import { 
  TrendingUp, Scissors, Trash2, Check, MousePointer, ArrowRight, 
  Download, ZoomIn, ZoomOut, RotateCcw, Image
} from "lucide-react";
import { formatDateTime } from "@/utils/csvParser";
import html2canvas from "html2canvas";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  const [newSessionSetTemp, setNewSessionSetTemp] = useState<string>("");
  
  // Zoom state
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 100]);
  const chartRef = useRef<HTMLDivElement>(null);

  // Check if any logger is hotwater type
  const hasHotwaterLogger = loggers.some(l => l.type === 'hotwater');

  // Use first logger as primary timeline (all loggers should have same timestamps)
  const primaryLogger = loggers[0];

  // Build full chart data
  const fullChartData = useMemo(() => {
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

  // Zoomed chart data
  const chartData = useMemo(() => {
    if (fullChartData.length === 0) return [];
    const startIdx = Math.floor((zoomRange[0] / 100) * fullChartData.length);
    const endIdx = Math.ceil((zoomRange[1] / 100) * fullChartData.length);
    return fullChartData.slice(startIdx, Math.max(endIdx, startIdx + 1));
  }, [fullChartData, zoomRange]);

  const hasFValue = useMemo(() => 
    loggers.some(logger => logger.records.some(r => r.fValue !== undefined)),
    [loggers]
  );

  // Get last session's end time for "continue from here" feature
  const lastSessionEndTime = useMemo(() => {
    if (sessions.length === 0) return null;
    const sortedSessions = [...sessions].sort((a, b) => b.endTime.getTime() - a.endTime.getTime());
    return sortedSessions[0].endTime.getTime();
  }, [sessions]);

  // Start new session from last session's end
  const startFromLastSession = useCallback(() => {
    if (lastSessionEndTime) {
      setSelectionStart(lastSessionEndTime);
      setSelectionEnd(null);
      setIsSelectingSession(true);
    }
  }, [lastSessionEndTime]);

  // Click-based selection
  const handleChartClick = useCallback((e: any) => {
    if (!isSelectingSession) return;
    if (e && e.activePayload && e.activePayload[0]) {
      const timestamp = e.activePayload[0].payload.timestamp;
      
      if (selectionStart === null) {
        setSelectionStart(timestamp);
        setSelectionEnd(null);
      } else if (selectionEnd === null) {
        setSelectionEnd(timestamp);
      } else {
        setSelectionStart(timestamp);
        setSelectionEnd(null);
      }
    }
  }, [isSelectingSession, selectionStart, selectionEnd]);

  const confirmSession = useCallback(() => {
    if (selectionStart === null || selectionEnd === null) return;
    
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    
    const hasOverlap = sessions.some(session => {
      const sessionStart = session.startTime.getTime();
      const sessionEnd = session.endTime.getTime();
      return (start < sessionEnd && end > sessionStart);
    });
    
    if (hasOverlap) {
      alert("선택한 구간이 기존 회차와 겹칩니다. 겹치지 않게 선택해주세요.");
      return;
    }
    
    const newSession: MeasurementSession = {
      id: sessions.length + 1,
      name: newSessionName || `${sessions.length + 1}차 측정`,
      startTime: new Date(start),
      endTime: new Date(end),
      setTemperature: newSessionSetTemp ? parseFloat(newSessionSetTemp) : undefined,
    };
    
    onSessionsChange([...sessions, newSession]);
    setIsSelectingSession(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSessionName("");
    setNewSessionSetTemp("");
  }, [selectionStart, selectionEnd, sessions, newSessionName, newSessionSetTemp, onSessionsChange]);

  const cancelSelection = useCallback(() => {
    setIsSelectingSession(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    setNewSessionName("");
    setNewSessionSetTemp("");
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

  const findChartTimeForTimestamp = (ts: number) => {
    const point = chartData.find(d => d.timestamp >= ts);
    return point?.time || chartData[chartData.length - 1]?.time;
  };

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const range = zoomRange[1] - zoomRange[0];
    if (range <= 10) return;
    const center = (zoomRange[0] + zoomRange[1]) / 2;
    const newRange = range * 0.6;
    setZoomRange([
      Math.max(0, center - newRange / 2),
      Math.min(100, center + newRange / 2)
    ]);
  }, [zoomRange]);

  const handleZoomOut = useCallback(() => {
    const range = zoomRange[1] - zoomRange[0];
    if (range >= 100) return;
    const center = (zoomRange[0] + zoomRange[1]) / 2;
    const newRange = Math.min(100, range * 1.5);
    setZoomRange([
      Math.max(0, center - newRange / 2),
      Math.min(100, center + newRange / 2)
    ]);
  }, [zoomRange]);

  const handleResetZoom = useCallback(() => {
    setZoomRange([0, 100]);
  }, []);

  // Save chart as image
  const saveChartAsImage = useCallback(async (sessionId?: number) => {
    if (!chartRef.current) return;
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      
      const link = document.createElement('a');
      const fileName = sessionId 
        ? `temperature_chart_session_${sessionId}.png`
        : 'temperature_chart_full.png';
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to save chart:', error);
    }
  }, []);

  // Zoom to specific session
  const zoomToSession = useCallback((session: MeasurementSession) => {
    if (fullChartData.length === 0) return;
    
    const startTs = session.startTime.getTime();
    const endTs = session.endTime.getTime();
    const minTs = fullChartData[0].timestamp;
    const maxTs = fullChartData[fullChartData.length - 1].timestamp;
    const totalRange = maxTs - minTs;
    
    const startPercent = Math.max(0, ((startTs - minTs) / totalRange) * 100 - 5);
    const endPercent = Math.min(100, ((endTs - minTs) / totalRange) * 100 + 5);
    
    setZoomRange([startPercent, endPercent]);
  }, [fullChartData]);

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
              {/* Zoom controls */}
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleResetZoom}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Save image dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Image className="w-4 h-4 mr-2" />
                    이미지 저장
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => saveChartAsImage()}>
                    <Download className="w-4 h-4 mr-2" />
                    전체 그래프 저장
                  </DropdownMenuItem>
                  {sessions.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      {sessions.map(session => (
                        <DropdownMenuItem 
                          key={session.id}
                          onClick={() => {
                            zoomToSession(session);
                            setTimeout(() => saveChartAsImage(session.id), 500);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {session.name} 저장
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {!isSelectingSession ? (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setIsSelectingSession(true)}
                  >
                    <Scissors className="w-4 h-4 mr-2" />
                    회차 분할
                  </Button>
                  {lastSessionEndTime && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={startFromLastSession}
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      이어서 분할
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="회차 이름"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="h-8 w-24"
                  />
                  {hasHotwaterLogger && (
                    <Input
                      placeholder="열수 설정온도"
                      type="number"
                      value={newSessionSetTemp}
                      onChange={(e) => setNewSessionSetTemp(e.target.value)}
                      className="h-8 w-28"
                    />
                  )}
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
                    ? "그래프를 클릭하여 시작점을 선택하세요" 
                    : selectionEnd === null
                      ? `⏱ 시작점: ${new Date(selectionStart).toLocaleTimeString()} - 종료점을 클릭하세요`
                      : `✅ 선택됨: ${new Date(Math.min(selectionStart, selectionEnd)).toLocaleTimeString()} ~ ${new Date(Math.max(selectionStart, selectionEnd)).toLocaleTimeString()}`
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* Zoom slider */}
          <div className="flex items-center gap-4 px-2">
            <Label className="text-xs text-muted-foreground shrink-0">확대/축소:</Label>
            <Slider
              value={zoomRange}
              onValueChange={(value) => setZoomRange(value as [number, number])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground shrink-0">
              {Math.round(zoomRange[0])}% - {Math.round(zoomRange[1])}%
            </span>
          </div>
          
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
                  className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => zoomToSession(session)}
                >
                  {session.name}
                  {session.setTemperature && (
                    <span className="text-xs opacity-70">({session.setTemperature}℃)</span>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeSession(session.id); }}
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
        <div ref={chartRef} className="h-[450px] w-full bg-background p-2 rounded-lg" style={{ cursor: isSelectingSession ? 'crosshair' : 'default' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={chartData} 
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onClick={handleChartClick}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
