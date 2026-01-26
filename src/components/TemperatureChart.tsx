import { useMemo, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine, ReferenceArea, Area
} from "recharts";
import { 
  TrendingUp, Scissors, Trash2, Check, MousePointer, ArrowRight, 
  Download, ZoomIn, ZoomOut, RotateCcw, Image, Target
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
  '#3b82f6', // blue-500 - primary
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
];

const LOGGER_GRADIENTS = [
  { start: 'rgba(59, 130, 246, 0.3)', end: 'rgba(59, 130, 246, 0.05)' },
  { start: 'rgba(16, 185, 129, 0.3)', end: 'rgba(16, 185, 129, 0.05)' },
  { start: 'rgba(245, 158, 11, 0.3)', end: 'rgba(245, 158, 11, 0.05)' },
  { start: 'rgba(139, 92, 246, 0.3)', end: 'rgba(139, 92, 246, 0.05)' },
  { start: 'rgba(239, 68, 68, 0.3)', end: 'rgba(239, 68, 68, 0.05)' },
];

export interface TemperatureChartRef {
  chartRef: React.RefObject<HTMLDivElement>;
}

export const TemperatureChart = forwardRef<TemperatureChartRef, TemperatureChartProps>(
  ({ loggers, sessions, onSessionsChange }, ref) => {
  const [isSelectingSession, setIsSelectingSession] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [newSessionSetTemp, setNewSessionSetTemp] = useState<string>("");
  
  // Zoom state
  const [zoomRange, setZoomRange] = useState<[number, number]>([0, 100]);
  const chartRef = useRef<HTMLDivElement>(null);

  // Expose chartRef through imperative handle
  useImperativeHandle(ref, () => ({
    chartRef
  }));

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
      'rgba(59, 130, 246, 0.12)', 
      'rgba(16, 185, 129, 0.12)', 
      'rgba(245, 158, 11, 0.12)', 
      'rgba(239, 68, 68, 0.12)',
      'rgba(139, 92, 246, 0.12)'
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 min-w-[180px]">
          <p className="text-xs text-muted-foreground mb-2 border-b pb-2">
            {payload[0]?.payload?.fullTime || label}
          </p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs">{entry.name}</span>
                </div>
                <span className="text-xs font-mono font-medium">
                  {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
                  {entry.dataKey?.startsWith('temp') ? '°C' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
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
    <Card className="bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b bg-muted/30">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <span>온도 프로파일</span>
            </CardTitle>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 border rounded-lg p-1 bg-background">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomIn} title="확대">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleZoomOut} title="축소">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleResetZoom} title="초기화">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Save image dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Image className="w-4 h-4 mr-2" />
                    이미지
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
                      이어서
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
            <Label className="text-xs text-muted-foreground shrink-0">범위:</Label>
            <Slider
              value={zoomRange}
              onValueChange={(value) => setZoomRange(value as [number, number])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground shrink-0 font-mono">
              {Math.round(zoomRange[0])}% - {Math.round(zoomRange[1])}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex">
          {/* Main Chart Area */}
          <div ref={chartRef} className="flex-1 h-[420px] bg-gradient-to-b from-background to-muted/20 p-4" style={{ cursor: isSelectingSession ? 'crosshair' : 'default' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData} 
                margin={{ top: 10, right: hasFValue ? 60 : 20, left: 10, bottom: 10 }}
                onClick={handleChartClick}
              >
                <defs>
                  {loggers.map((_, idx) => (
                    <linearGradient key={`gradient-${idx}`} id={`colorTemp${idx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={LOGGER_COLORS[idx % LOGGER_COLORS.length]} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={LOGGER_COLORS[idx % LOGGER_COLORS.length]} stopOpacity={0.05}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  yAxisId="temp"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  label={{ 
                    value: 'Temperature (°C)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } 
                  }}
                />
                {hasFValue && (
                  <YAxis 
                    yAxisId="fvalue"
                    orientation="right"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    label={{ 
                      value: 'F-Value', 
                      angle: 90, 
                      position: 'insideRight', 
                      style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } 
                    }}
                  />
                )}
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
                
                {/* Session reference areas */}
                {sessions.map((session, idx) => (
                  <ReferenceArea
                    key={session.id}
                    yAxisId="temp"
                    x1={findChartTimeForTimestamp(session.startTime.getTime())}
                    x2={findChartTimeForTimestamp(session.endTime.getTime())}
                    fill={getSessionColor(idx)}
                    stroke={LOGGER_COLORS[idx % LOGGER_COLORS.length]}
                    strokeWidth={1}
                    strokeOpacity={0.5}
                    label={{ 
                      value: session.name, 
                      position: 'insideTop',
                      style: { fontSize: 10, fontWeight: 600, fill: 'hsl(var(--foreground))' }
                    }}
                  />
                ))}
                
                {/* Current selection area */}
                {isSelectingSession && selectionStart !== null && selectionEnd !== null && (
                  <ReferenceArea
                    yAxisId="temp"
                    x1={findChartTimeForTimestamp(Math.min(selectionStart, selectionEnd))}
                    x2={findChartTimeForTimestamp(Math.max(selectionStart, selectionEnd))}
                    fill="rgba(59, 130, 246, 0.25)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                )}
                
                {/* Reference lines for thresholds */}
                <ReferenceLine 
                  y={63} 
                  yAxisId="temp"
                  stroke="#22c55e" 
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ 
                    value: 'Target (63°C)', 
                    position: 'right',
                    style: { fontSize: 9, fill: '#22c55e', fontWeight: 500 }
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
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, fill: 'white' }}
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
                      opacity={0.7}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Sidebar */}
          {sessions.length > 0 && (
            <div className="w-48 border-l bg-muted/30 p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Validation Stats
              </div>
              {sessions.slice(0, 3).map((session, idx) => (
                <div key={session.id} className="p-2.5 rounded-lg border bg-card text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{session.name}</span>
                    <button 
                      onClick={() => removeSession(session.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-1.5 rounded bg-muted/50 text-center">
                      <div className="text-[10px] text-muted-foreground">시작</div>
                      <div className="font-mono text-[11px]">
                        {session.startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-muted/50 text-center">
                      <div className="text-[10px] text-muted-foreground">종료</div>
                      <div className="font-mono text-[11px]">
                        {session.endTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  {session.setTemperature && (
                    <div className="p-1.5 rounded bg-sky-500/10 text-center">
                      <div className="text-[10px] text-muted-foreground">열수 설정</div>
                      <div className="font-mono text-sky-600 font-medium">{session.setTemperature}°C</div>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-[10px]"
                    onClick={() => zoomToSession(session)}
                  >
                    <ZoomIn className="w-3 h-3 mr-1" />
                    확대 보기
                  </Button>
                </div>
              ))}
              {sessions.length > 3 && (
                <div className="text-center text-xs text-muted-foreground">
                  +{sessions.length - 3} more sessions
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logger Legend */}
        <div className="flex flex-wrap gap-2 p-3 border-t bg-muted/20">
          {loggers.map((logger, idx) => (
            <Badge 
              key={logger.id} 
              variant="outline"
              className="gap-1.5 px-2.5 py-1"
              style={{ 
                borderColor: LOGGER_COLORS[idx % LOGGER_COLORS.length], 
                color: LOGGER_COLORS[idx % LOGGER_COLORS.length],
                backgroundColor: `${LOGGER_COLORS[idx % LOGGER_COLORS.length]}10`
              }}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LOGGER_COLORS[idx % LOGGER_COLORS.length] }}
              />
              {logger.name}
              {logger.records.some(r => r.fValue !== undefined) && (
                <span className="text-[10px] opacity-70">(F값)</span>
              )}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

TemperatureChart.displayName = "TemperatureChart";
