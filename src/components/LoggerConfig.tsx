import { DataLogger, MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, Package, Settings } from "lucide-react";
import { formatDateTime } from "@/utils/csvParser";

interface LoggerConfigProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
  onUpdateLogger: (loggerId: string, updates: Partial<DataLogger>) => void;
  onUpdateSession: (sessionId: number, updates: Partial<MeasurementSession>) => void;
}

const LOGGER_COLORS = [
  { border: 'border-sky-500', bg: 'bg-sky-500/10' },
  { border: 'border-green-500', bg: 'bg-green-500/10' },
  { border: 'border-orange-500', bg: 'bg-orange-500/10' },
  { border: 'border-purple-500', bg: 'bg-purple-500/10' },
];

export function LoggerConfig({ loggers, sessions, onUpdateLogger, onUpdateSession }: LoggerConfigProps) {
  // Get loggers that are configured as hotwater type
  const hotwaterLoggers = loggers.filter(l => l.type === 'hotwater');

  return (
    <div className="space-y-6">
      {/* Logger Type Configuration */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-primary" />
          로거별 측정 유형 설정
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
                  <Badge variant="outline" className="text-xs">
                    {logger.type === 'hotwater' ? '열수' : logger.type === 'product' ? '품온' : '미설정'}
                  </Badge>
                </div>
                
                <RadioGroup
                  value={logger.type || ''}
                  onValueChange={(value) => 
                    onUpdateLogger(logger.id, { type: value as 'hotwater' | 'product' })
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

                {logger.type === 'product' && (
                  <RadioGroup
                    value={logger.sterilizationType || 'pasteurization'}
                    onValueChange={(value) => 
                      onUpdateLogger(logger.id, { sterilizationType: value as 'pasteurization' | 'sterilization' })
                    }
                    className="flex gap-4 ml-4"
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Session-specific Hot Water Temperature Settings */}
      {sessions.length > 0 && hotwaterLoggers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            회차별 열수 설정 온도
          </h3>
          <Card className="bg-card">
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">회차</th>
                      <th className="text-left py-2 px-2 font-medium">시간 범위</th>
                      <th className="text-left py-2 px-2 font-medium">열수 설정 온도 (℃)</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">기준 온도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id} className="border-b last:border-b-0">
                        <td className="py-2 px-2">
                          <Badge variant="secondary">{session.name}</Badge>
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {formatDateTime(session.startTime)} ~ {formatDateTime(session.endTime)}
                        </td>
                        <td className="py-2 px-2">
                          <Input
                            type="number"
                            placeholder="예: 85"
                            value={session.setTemperature || ''}
                            onChange={(e) => 
                              onUpdateSession(session.id, { 
                                setTemperature: e.target.value ? parseFloat(e.target.value) : undefined 
                              })
                            }
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {session.setTemperature 
                            ? `≥ ${(session.setTemperature - 2.4).toFixed(1)}℃`
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
