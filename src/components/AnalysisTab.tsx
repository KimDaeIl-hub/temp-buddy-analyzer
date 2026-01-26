import { useState, useCallback } from "react";
import { DataLogger, MeasurementSession, TemperatureRecord } from "@/types/temperature";
import { AnalysisGroup, AnalysisGroupItem, AnalysisGroupResult } from "@/types/analysis";
import { getRecordsInSession, calculateProductResults, calculateHotWaterResults } from "@/utils/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Beaker, 
  Droplets,
  Calculator,
  Clock,
  Thermometer,
  TrendingUp
} from "lucide-react";

interface AnalysisTabProps {
  loggers: DataLogger[];
  sessions: MeasurementSession[];
  analysisGroups: AnalysisGroup[];
  onAnalysisGroupsChange: (groups: AnalysisGroup[]) => void;
}

const LOGGER_COLORS: Record<string, string> = {
  'logger-1': 'bg-sky-100 border-sky-400 text-sky-700',
  'logger-2': 'bg-rose-100 border-rose-400 text-rose-700',
  'logger-3': 'bg-emerald-100 border-emerald-400 text-emerald-700',
  'logger-4': 'bg-amber-100 border-amber-400 text-amber-700',
};

export function AnalysisTab({ loggers, sessions, analysisGroups, onAnalysisGroupsChange }: AnalysisTabProps) {
  const [draggedItem, setDraggedItem] = useState<AnalysisGroupItem | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  const configuredLoggers = loggers.filter(l => l.type !== null);

  const handleCreateGroup = () => {
    const name = newGroupName.trim() || `분석 그룹 ${analysisGroups.length + 1}`;
    const newGroup: AnalysisGroup = {
      id: `group-${Date.now()}`,
      name,
      items: [],
      createdAt: new Date(),
    };
    onAnalysisGroupsChange([...analysisGroups, newGroup]);
    setNewGroupName("");
  };

  const handleDeleteGroup = (groupId: string) => {
    onAnalysisGroupsChange(analysisGroups.filter(g => g.id !== groupId));
  };

  const handleDragStart = (e: React.DragEvent, item: AnalysisGroupItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (!draggedItem) return;

    const updatedGroups = analysisGroups.map(group => {
      if (group.id === groupId) {
        // Check if already exists
        const exists = group.items.some(
          item => item.loggerId === draggedItem.loggerId && item.sessionId === draggedItem.sessionId
        );
        if (exists) return group;

        return {
          ...group,
          items: [...group.items, draggedItem],
        };
      }
      return group;
    });

    onAnalysisGroupsChange(updatedGroups);
    setDraggedItem(null);
  };

  const handleRemoveItem = (groupId: string, loggerId: string, sessionId: number) => {
    const updatedGroups = analysisGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.filter(
            item => !(item.loggerId === loggerId && item.sessionId === sessionId)
          ),
        };
      }
      return group;
    });
    onAnalysisGroupsChange(updatedGroups);
  };

  const calculateGroupResult = useCallback((group: AnalysisGroup): AnalysisGroupResult | null => {
    if (group.items.length === 0) return null;

    const itemResults: AnalysisGroupResult['itemResults'] = [];
    let totalRecords = 0;
    let tempSum = 0;
    let tempCount = 0;
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let totalDurationMinutes = 0;
    let totalFValue = 0;

    group.items.forEach(item => {
      const logger = loggers.find(l => l.id === item.loggerId);
      const session = sessions.find(s => s.id === item.sessionId);
      
      if (!logger || !session) return;

      const sessionRecords = getRecordsInSession(logger.records, session);
      if (sessionRecords.length === 0) return;

      let avgTemp = 0;
      let duration = 0;
      let fValue = 0;

      if (logger.type === 'hotwater') {
        const setTemp = session.setTemperature || logger.setTemperature || 0;
        const result = calculateHotWaterResults(sessionRecords, setTemp);
        avgTemp = result.averageTemp;
        duration = result.durationMinutes;
      } else if (logger.type === 'product') {
        const sterilType = logger.sterilizationType || 'pasteurization';
        const result = calculateProductResults(sessionRecords, sterilType);
        avgTemp = result.averageTemp;
        duration = result.durationMinutes;
        fValue = result.sessionFValue;
      }

      // Update aggregates
      sessionRecords.forEach(r => {
        tempSum += r.temperature;
        tempCount++;
        minTemp = Math.min(minTemp, r.temperature);
        maxTemp = Math.max(maxTemp, r.temperature);
      });
      totalRecords += sessionRecords.length;
      totalDurationMinutes += duration;
      totalFValue += fValue;

      itemResults.push({
        loggerId: item.loggerId,
        loggerName: item.loggerName,
        sessionId: item.sessionId,
        sessionName: item.sessionName,
        averageTemp: avgTemp,
        durationMinutes: duration,
        fValue,
        recordCount: sessionRecords.length,
      });
    });

    if (tempCount === 0) return null;

    return {
      groupId: group.id,
      groupName: group.name,
      items: group.items,
      totalRecords,
      averageTemp: tempSum / tempCount,
      minTemp: minTemp === Infinity ? 0 : minTemp,
      maxTemp: maxTemp === -Infinity ? 0 : maxTemp,
      totalDurationMinutes,
      totalFValue,
      itemResults,
    };
  }, [loggers, sessions]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Available Items */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GripVertical className="w-4 h-4" />
            사용 가능한 항목
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            항목을 드래그하여 분석 그룹에 추가하세요
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-4">
              {configuredLoggers.map(logger => (
                <div key={logger.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {logger.type === 'hotwater' ? (
                      <Droplets className="w-4 h-4 text-sky-500" />
                    ) : (
                      <Beaker className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="text-sm font-medium">{logger.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {logger.type === 'hotwater' ? '열수' : '품온'}
                    </Badge>
                  </div>
                  
                  <div className="ml-6 space-y-1">
                    {sessions.map(session => (
                      <div
                        key={`${logger.id}-${session.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, {
                          loggerId: logger.id,
                          loggerName: logger.name,
                          loggerType: logger.type,
                          sessionId: session.id,
                          sessionName: session.name,
                          sterilizationType: logger.sterilizationType,
                        })}
                        className={`
                          px-3 py-2 rounded-md border cursor-grab active:cursor-grabbing
                          hover:shadow-sm transition-all text-xs
                          ${LOGGER_COLORS[logger.id] || 'bg-muted border-border'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3 h-3 opacity-50" />
                          <span className="font-medium">{session.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {configuredLoggers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  로거를 먼저 설정해주세요
                </p>
              )}
              {configuredLoggers.length > 0 && sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  회차를 먼저 분할해주세요
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Analysis Groups */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              분석 그룹
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="그룹 이름"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-32 h-8 text-xs"
              />
              <Button size="sm" onClick={handleCreateGroup} className="h-8">
                <Plus className="w-4 h-4 mr-1" />
                그룹 추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-3">
            <div className="space-y-4">
              {analysisGroups.map(group => {
                const result = calculateGroupResult(group);
                
                return (
                  <Card 
                    key={group.id}
                    className="border-2 border-dashed"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, group.id)}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{group.name}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGroup(group.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Drop zone */}
                      {group.items.length === 0 ? (
                        <div className="h-20 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                          <p className="text-xs text-muted-foreground">
                            여기에 항목을 드래그하세요
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Items */}
                          <div className="flex flex-wrap gap-2">
                            {group.items.map(item => (
                              <Badge
                                key={`${item.loggerId}-${item.sessionId}`}
                                variant="secondary"
                                className={`
                                  gap-1 pr-1
                                  ${LOGGER_COLORS[item.loggerId] || ''}
                                `}
                              >
                                <span className="text-xs">
                                  {item.loggerName} - {item.sessionName}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(group.id, item.loggerId, item.sessionId)}
                                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>

                          {/* Results */}
                          {result && (
                            <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Thermometer className="w-3 h-3" />
                                  평균 온도 (기준치 이상)
                                </div>
                                <div className="text-lg font-bold text-primary">
                                  {(result.itemResults.reduce((sum, item) => sum + item.averageTemp, 0) / result.itemResults.length).toFixed(2)}°C
                                </div>
                              </div>
                              
                              <div className="p-2 rounded-lg bg-secondary">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  평균 유지 시간
                                </div>
                                <div className="text-lg font-bold">
                                  {(result.totalDurationMinutes / result.itemResults.length).toFixed(1)}분
                                </div>
                              </div>
                              
                              <div className="p-2 rounded-lg bg-accent">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <TrendingUp className="w-3 h-3" />
                                  평균 F-value
                                </div>
                                <div className="text-lg font-bold text-accent-foreground">
                                  {(result.totalFValue / result.itemResults.length).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Individual item results */}
                          {result && result.itemResults.length > 0 && (
                            <div className="space-y-1 pt-2">
                              <div className="text-xs font-medium text-muted-foreground">개별 항목 결과</div>
                              <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted">
                                    <tr>
                                      <th className="px-2 py-1 text-left">로거</th>
                                      <th className="px-2 py-1 text-left">회차</th>
                                      <th className="px-2 py-1 text-right">평균 온도 (기준치↑)</th>
                                      <th className="px-2 py-1 text-right">유지 시간</th>
                                      <th className="px-2 py-1 text-right">F-value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {result.itemResults.map((item, idx) => (
                                      <tr key={idx} className="border-t">
                                        <td className="px-2 py-1">{item.loggerName}</td>
                                        <td className="px-2 py-1">{item.sessionName}</td>
                                        <td className="px-2 py-1 text-right">{item.averageTemp.toFixed(2)}°C</td>
                                        <td className="px-2 py-1 text-right">{item.durationMinutes.toFixed(1)}분</td>
                                        <td className="px-2 py-1 text-right">{item.fValue.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {analysisGroups.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">분석 그룹을 생성하여 시작하세요</p>
                  <p className="text-xs mt-1">로거와 회차를 그룹으로 묶어 통합 분석할 수 있습니다</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
