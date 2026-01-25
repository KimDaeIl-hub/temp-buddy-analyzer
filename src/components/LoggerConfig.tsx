import { DataLogger } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Thermometer, Droplets, Package } from "lucide-react";

interface LoggerConfigProps {
  loggers: DataLogger[];
  onUpdateLogger: (loggerId: string, updates: Partial<DataLogger>) => void;
}

export function LoggerConfig({ loggers, onUpdateLogger }: LoggerConfigProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {loggers.map((logger) => (
        <Card key={logger.id} className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Thermometer className="w-4 h-4 text-primary" />
              <span className="truncate" title={logger.name}>
                {logger.name.length > 30 ? `${logger.name.substring(0, 30)}...` : logger.name}
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {logger.records.length.toLocaleString()}개 레코드
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">측정 유형</Label>
              <RadioGroup
                value={logger.type || ''}
                onValueChange={(value) => 
                  onUpdateLogger(logger.id, { type: value as 'hotwater' | 'product' })
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hotwater" id={`${logger.id}-hotwater`} />
                  <Label 
                    htmlFor={`${logger.id}-hotwater`}
                    className="flex items-center gap-2 cursor-pointer font-normal"
                  >
                    <Droplets className="w-4 h-4 text-chart-1" />
                    열수 측정
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="product" id={`${logger.id}-product`} />
                  <Label 
                    htmlFor={`${logger.id}-product`}
                    className="flex items-center gap-2 cursor-pointer font-normal"
                  >
                    <Package className="w-4 h-4 text-chart-2" />
                    품온 측정
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {logger.type === 'hotwater' && (
              <div className="space-y-2">
                <Label htmlFor={`${logger.id}-settemp`} className="text-sm">
                  설정 온도 (℃)
                </Label>
                <Input
                  id={`${logger.id}-settemp`}
                  type="number"
                  placeholder="예: 85"
                  value={logger.setTemperature || ''}
                  onChange={(e) => 
                    onUpdateLogger(logger.id, { setTemperature: parseFloat(e.target.value) || undefined })
                  }
                  className="h-9"
                />
                {logger.setTemperature && (
                  <p className="text-xs text-muted-foreground">
                    기준 온도: {(logger.setTemperature - 2.4).toFixed(1)}℃ 이상
                  </p>
                )}
              </div>
            )}

            {logger.type === 'product' && (
              <div className="space-y-2">
                <Label className="text-sm">살균 조건</Label>
                <RadioGroup
                  value={logger.sterilizationType || 'pasteurization'}
                  onValueChange={(value) => 
                    onUpdateLogger(logger.id, { sterilizationType: value as 'pasteurization' | 'sterilization' })
                  }
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pasteurization" id={`${logger.id}-pasteurization`} />
                    <Label htmlFor={`${logger.id}-pasteurization`} className="cursor-pointer font-normal">
                      살균 (F63℃)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sterilization" id={`${logger.id}-sterilization`} />
                    <Label htmlFor={`${logger.id}-sterilization`} className="cursor-pointer font-normal">
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
  );
}
