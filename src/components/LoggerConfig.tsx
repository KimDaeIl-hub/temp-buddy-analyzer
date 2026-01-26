import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, Package } from "lucide-react";
import { formatDateTime } from "@/utils/csvParser";

interface LoggerConfigProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
  onUpdateLogger: (loggerId: string, updates: Partial<DataLogger>, targetFileId?: string) => void;
  onUpdateSession: (sessionId: number, updates: Partial<MeasurementSession>, targetFileId?: string) => void;
  currentFileId?: string; // For individual mode
  viewMode: 'combined' | 'individual';
}

const LOGGER_COLORS = [
  { border: 'border-sky-500', bg: 'bg-sky-500/10' },
  { border: 'border-green-500', bg: 'bg-green-500/10' },
  { border: 'border-orange-500', bg: 'bg-orange-500/10' },
  { border: 'border-purple-500', bg: 'bg-purple-500/10' },
];

export function LoggerConfig({ loggers, sessions, onUpdateLogger, onUpdateSession, currentFileId, viewMode }: LoggerConfigProps) {
  // Extract file ID from prefixed logger ID for combined mode
  const extractFileId = (loggerId: string): string | undefined => {
    if (viewMode === 'combined' && loggerId.includes('-')) {
      // Format: fileId-loggerId
      const parts = loggerId.split('-');
      // The file ID is everything before the last part
      return parts.slice(0, -1).join('-');
    }
    return currentFileId;
  };

  const handleLoggerUpdate = (loggerId: string, updates: Partial<DataLogger>) => {
    const targetFileId = viewMode === 'individual' ? currentFileId : extractFileId(loggerId);
    onUpdateLogger(loggerId, updates, targetFileId);
  };

  const handleSessionUpdate = (sessionId: number, updates: Partial<MeasurementSession>) => {
    onUpdateSession(sessionId, updates, currentFileId);
  };

  // Get loggers that are configured as hotwater type
  const hotwaterLoggers = loggers.filter(l => l.type === 'hotwater');

  return (
    <div className="space-y-6">
      {/* Logger Type Configuration */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-primary" />
          로거별 측정 유형 설정
          {viewMode === 'individual' && currentFileId && (
            <Badge variant="secondary" className="text-xs ml-2">개별 파일 모드</Badge>
          )}
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {loggers.map((logger, idx) => (
            <Card 
              key={logger.id} 
              className={`bg-card border-l-4 ${LOGGER_COLORS[idx % LOGGER_COLORS.length].border}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate" title={logger.name}>
                    {logger.name.length > 25 ? `${logger.name.substring(0, 25)}...` : logger.name}
                  </span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {logger.type === 'hotwater' ? '열수' : logger.type === 'product' ? '품온' : '미설정'}
                  </Badge>
                </div>
                
                <RadioGroup
                  value={logger.type || ''}
                  onValueChange={(value) => 
                    handleLoggerUpdate(logger.id, { type: value as 'hotwater' | 'product' })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hotwater" id={`${logger.id}-hotwater`} />
                    <Label 
                      htmlFor={`${logger.id}-hotwater`}
                      className="flex items-center gap-1 cursor-pointer font-normal text-sm"
                    >
                      <Droplets className="w-3 h-3 text-chart-1" />
                      열수
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="product" id={`${logger.id}-product`} />
                    <Label 
                      htmlFor={`${logger.id}-product`}
                      className="flex items-center gap-1 cursor-pointer font-normal text-sm"
                    >
                      <Package className="w-3 h-3 text-chart-2" />
                      품온
                    </Label>
                  </div>
                </RadioGroup>

                {/* Hot water: show session temperature inputs */}
                {logger.type === 'hotwater' && sessions.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <Label className="text-xs text-muted-foreground">회차별 열수 설정 온도</Label>
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <div key={session.id} className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs shrink-0 min-w-[45px] justify-center">
                            {session.name}
                          </Badge>
                          <Input
                            type="number"
                            placeholder="예: 85"
                            value={session.setTemperature || ''}
                            onChange={(e) => 
                              handleSessionUpdate(session.id, { 
                                setTemperature: e.target.value ? parseFloat(e.target.value) : undefined 
                              })
                            }
                            className="h-7 w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {session.setTemperature 
                              ? `≥ ${(session.setTemperature - 2.4).toFixed(1)}℃`
                              : '℃'
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product: show sterilization type selection */}
                {logger.type === 'product' && (
                  <div className="mt-3 pt-3 border-t">
                    <Label className="text-xs text-muted-foreground mb-2 block">살균/멸균 구분</Label>
                    <RadioGroup
                      value={logger.sterilizationType || 'pasteurization'}
                      onValueChange={(value) => 
                        handleLoggerUpdate(logger.id, { sterilizationType: value as 'pasteurization' | 'sterilization' })
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pasteurization" id={`${logger.id}-past`} />
                        <Label htmlFor={`${logger.id}-past`} className="cursor-pointer font-normal text-xs">
                          살균 (F63℃)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sterilization" id={`${logger.id}-ster`} />
                        <Label htmlFor={`${logger.id}-ster`} className="cursor-pointer font-normal text-xs">
                          멸균 (F121℃)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
