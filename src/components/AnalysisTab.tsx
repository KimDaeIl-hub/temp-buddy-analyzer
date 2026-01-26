import { useState, useCallback } from "react";
import { DataLogger, MeasurementSession, TemperatureRecord } from "@/types/temperature";
import { AnalysisGroup, AnalysisGroupItem, AnalysisGroupResult } from "@/types/analysis";
import { DataFile } from "@/types/file";
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
  TrendingUp,
  FileText
} from "lucide-react";

interface AnalysisTabProps {
  files: DataFile[];
  analysisGroups: AnalysisGroup[];
  onAnalysisGroupsChange: (groups: AnalysisGroup[]) => void;
}

const LOGGER_COLORS: Record<string, string> = {
  'logger-1': 'bg-sky-100 border-sky-400 text-sky-700',
  'logger-2': 'bg-rose-100 border-rose-400 text-rose-700',
  'logger-3': 'bg-emerald-100 border-emerald-400 text-emerald-700',
  'logger-4': 'bg-amber-100 border-amber-400 text-amber-700',
};

const GROUP_COLORS = [
  { border: 'border-primary', bg: 'bg-primary/5', accent: 'bg-primary/10' },
  { border: 'border-emerald-500', bg: 'bg-emerald-50', accent: 'bg-emerald-100' },
  { border: 'border-amber-500', bg: 'bg-amber-50', accent: 'bg-amber-100' },
  { border: 'border-rose-500', bg: 'bg-rose-50', accent: 'bg-rose-100' },
  { border: 'border-violet-500', bg: 'bg-violet-50', accent: 'bg-violet-100' },
  { border: 'border-cyan-500', bg: 'bg-cyan-50', accent: 'bg-cyan-100' },
];

export function AnalysisTab({ files, analysisGroups, onAnalysisGroupsChange }: AnalysisTabProps) {
  const [draggedItem, setDraggedItem] = useState<AnalysisGroupItem | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  // Get all configured loggers from all files - use composite ID for uniqueness
  const configuredLoggers = files.flatMap(file => 
    file.loggers.filter(l => l.type !== null).map(logger => ({
      logger,
      fileId: file.id,
      fileName: file.name,
      sessions: file.sessions,
      // Create unique composite ID for cross-file analysis
      compositeLoggerId: `${file.id}::${logger.id}`,
    }))
  );

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
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverGroupId(null);
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverGroupId(groupId);
  };

  const handleDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleDrop = (e: React.DragEvent, groupId: string) => {
    setDragOverGroupId(null);
    setIsDragging(false);
    e.preventDefault();
    if (!draggedItem) return;

    const updatedGroups = analysisGroups.map(group => {
      if (group.id === groupId) {
        // Check if already exists - use composite ID for proper uniqueness across files
        const exists = group.items.some(
          item => item.loggerId === draggedItem.loggerId && 
                  item.sessionId === draggedItem.sessionId
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

  const getGroupColor = (index: number) => {
    return GROUP_COLORS[index % GROUP_COLORS.length];
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
      // Find logger and session across all files using composite ID
      let logger: DataLogger | undefined;
      let session: MeasurementSession | undefined;
      
      // Parse composite ID to find correct file
      const [fileId, originalLoggerId] = item.loggerId.includes('::') 
        ? item.loggerId.split('::') 
        : [null, item.loggerId];
      
      for (const file of files) {
        // Match by composite ID or fallback to original ID
        if (fileId && file.id !== fileId) continue;
        
        const foundLogger = file.loggers.find(l => l.id === originalLoggerId || l.id === item.loggerId);
        const foundSession = file.sessions.find(s => s.id === item.sessionId);
        if (foundLogger && foundSession) {
          logger = foundLogger;
          session = foundSession;
          break;
        }
      }
      
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
  }, [files]);

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
              {configuredLoggers.map(({ logger, fileId, fileName, sessions, compositeLoggerId }) => (
                <div key={compositeLoggerId} className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {logger.type === 'hotwater' ? (
                      <Droplets className="w-4 h-4 text-sky-500 shrink-0" />
                    ) : (
                      <Beaker className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate max-w-[150px]">{logger.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">
                      {logger.type === 'hotwater' ? '열수' : '품온'}
                    </Badge>
                    {files.length > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" />
                        {fileName.replace('.csv', '')}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="ml-6 space-y-1">
                    {sessions.map(session => {
                      const itemData = {
                        loggerId: compositeLoggerId,
                        loggerName: files.length > 1 ? `[${fileName.replace('.csv', '')}] ${logger.name}` : logger.name,
                        loggerType: logger.type,
                        sessionId: session.id,
                        sessionName: session.name,
                        sterilizationType: logger.sterilizationType,
                      };
                      const isBeingDragged = isDragging && draggedItem?.loggerId === compositeLoggerId && draggedItem?.sessionId === session.id;
                      
                      return (
                        <div
                          key={`${compositeLoggerId}-${session.id}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, itemData)}
                          onDragEnd={handleDragEnd}
                          className={`
                            px-3 py-2 rounded-md border cursor-grab active:cursor-grabbing
                            transition-all text-xs
                            ${LOGGER_COLORS[logger.id] || 'bg-muted border-border'}
                            ${isBeingDragged ? 'opacity-50 scale-95 shadow-lg ring-2 ring-primary' : 'hover:shadow-sm'}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-3 h-3 opacity-50" />
                            <span className="font-medium truncate">{session.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {configuredLoggers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  로거를 먼저 설정해주세요
                </p>
              )}
              {configuredLoggers.length > 0 && configuredLoggers.every(c => c.sessions.length === 0) && (
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
              {analysisGroups.map((group, groupIndex) => {
                const result = calculateGroupResult(group);
                const groupColor = getGroupColor(groupIndex);
                const isDropTarget = dragOverGroupId === group.id;
                
                return (
                  <Card 
                    key={group.id}
                    className={`
                      border-2 transition-all duration-200
                      ${groupColor.border} ${groupColor.bg}
                      ${isDropTarget ? 'border-solid shadow-lg scale-[1.02]' : 'border-dashed'}
                      ${isDragging && !isDropTarget ? 'opacity-70' : ''}
                    `}
                    onDragOver={(e) => handleDragOver(e, group.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, group.id)}
                  >
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${groupColor.border.replace('border-', 'bg-')}`} />
                          <CardTitle className="text-sm">{group.name}</CardTitle>
                        </div>
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
                        <div className={`
                          h-20 rounded-lg border-2 border-dashed flex items-center justify-center
                          transition-all duration-200
                          ${isDropTarget 
                            ? 'border-primary bg-primary/10 scale-105' 
                            : 'border-muted-foreground/20'}
                        `}>
                          <p className={`text-xs ${isDropTarget ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                            {isDropTarget ? '여기에 놓으세요!' : '여기에 항목을 드래그하세요'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Items */}
                          <div className={`
                            flex flex-wrap gap-2 p-2 rounded-lg transition-all duration-200
                            ${isDropTarget ? 'bg-primary/10 ring-2 ring-primary/30' : ''}
                          `}>
                            {group.items.map(item => (
                              <Badge
                                key={`${item.loggerId}-${item.sessionId}`}
                                variant="secondary"
                                className={`
                                  gap-1 pr-1 transition-transform
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
                            {isDropTarget && (
                              <div className="px-3 py-1 rounded-md border-2 border-dashed border-primary bg-primary/5 text-xs text-primary animate-pulse">
                                + 여기에 추가
                              </div>
                            )}
                          </div>

                          {/* Results */}
                          {result && (
                            <div className={`grid grid-cols-3 gap-2 pt-3 border-t ${groupColor.accent}`}>
                              <div className="p-2 rounded-lg bg-background/80">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                  <Thermometer className="w-3 h-3 shrink-0" />
                                  <span>평균 온도</span>
                                </div>
                                <div className="text-base font-bold text-primary">
                                  {(result.itemResults.reduce((sum, item) => sum + item.averageTemp, 0) / result.itemResults.length).toFixed(2)}°C
                                </div>
                              </div>
                              
                              <div className="p-2 rounded-lg bg-background/80">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span>평균 유지</span>
                                </div>
                                <div className="text-base font-bold">
                                  {(result.totalDurationMinutes / result.itemResults.length).toFixed(1)}분
                                </div>
                              </div>
                              
                              <div className="p-2 rounded-lg bg-background/80">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                  <TrendingUp className="w-3 h-3 shrink-0" />
                                  <span>평균 F-value</span>
                                </div>
                                <div className="text-base font-bold text-accent-foreground">
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
