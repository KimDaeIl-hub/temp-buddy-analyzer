import { MeasurementSession } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Clock, Layers, ArrowRight } from "lucide-react";
import { formatDateTime } from "@/utils/csvParser";

interface SessionManagerProps {
  sessions: MeasurementSession[];
  onSessionsChange: (sessions: MeasurementSession[]) => void;
}

export function SessionManager({ sessions, onSessionsChange }: SessionManagerProps) {
  const removeSession = (sessionId: number) => {
    const filtered = sessions.filter(s => s.id !== sessionId);
    const renumbered = filtered.map((s, idx) => ({
      ...s,
      id: idx + 1,
      name: s.name.includes('차 측정') ? `${idx + 1}차 측정` : s.name,
    }));
    onSessionsChange(renumbered);
  };

  const clearAllSessions = () => {
    onSessionsChange([]);
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-primary" />
            측정 회차 ({sessions.length})
          </CardTitle>
          {sessions.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearAllSessions} className="text-destructive hover:text-destructive">
              전체 삭제
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">그래프에서 "회차 분할" 버튼을 클릭하여</p>
            <p className="text-sm">시작/종료 지점을 선택하세요</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div 
              key={session.id} 
              className="p-3 rounded-lg border bg-background/50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="font-medium">
                  {session.name}
                </Badge>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeSession(session.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">{formatDateTime(session.startTime)}</span>
                <ArrowRight className="w-3 h-3 shrink-0" />
                <span className="truncate">{formatDateTime(session.endTime)}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
