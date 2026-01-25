import { useState } from "react";
import { MeasurementSession, TemperatureRecord } from "@/types/temperature";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, Layers } from "lucide-react";
import { formatDateTime } from "@/utils/csvParser";

interface SessionManagerProps {
  records: TemperatureRecord[];
  sessions: MeasurementSession[];
  onSessionsChange: (sessions: MeasurementSession[]) => void;
}

export function SessionManager({ records, sessions, onSessionsChange }: SessionManagerProps) {
  const [newSessionName, setNewSessionName] = useState("");

  const addSession = () => {
    if (records.length === 0) return;
    
    const lastSession = sessions[sessions.length - 1];
    const startIndex = lastSession ? lastSession.endIndex + 1 : 0;
    const endIndex = records.length - 1;
    
    if (startIndex > endIndex) return;
    
    const startRecord = records[startIndex];
    const endRecord = records[endIndex];
    
    const newSession: MeasurementSession = {
      id: sessions.length + 1,
      name: newSessionName || `${sessions.length + 1}차 측정`,
      startIndex,
      endIndex,
      startTime: formatDateTime(startRecord.timestamp),
      endTime: formatDateTime(endRecord.timestamp),
    };
    
    onSessionsChange([...sessions, newSession]);
    setNewSessionName("");
  };

  const updateSession = (sessionId: number, updates: Partial<MeasurementSession>) => {
    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        const updated = { ...s, ...updates };
        // Update time strings based on indices
        if (updates.startIndex !== undefined) {
          const startRecord = records[updates.startIndex];
          if (startRecord) {
            updated.startTime = formatDateTime(startRecord.timestamp);
          }
        }
        if (updates.endIndex !== undefined) {
          const endRecord = records[updates.endIndex];
          if (endRecord) {
            updated.endTime = formatDateTime(endRecord.timestamp);
          }
        }
        return updated;
      }
      return s;
    });
    onSessionsChange(updatedSessions);
  };

  const removeSession = (sessionId: number) => {
    const filtered = sessions.filter(s => s.id !== sessionId);
    // Re-number sessions
    const renumbered = filtered.map((s, idx) => ({
      ...s,
      id: idx + 1,
      name: s.name.includes('차 측정') ? `${idx + 1}차 측정` : s.name,
    }));
    onSessionsChange(renumbered);
  };

  const createDefaultSessions = () => {
    if (records.length === 0) return;
    
    // Create a single session covering all data
    const defaultSession: MeasurementSession = {
      id: 1,
      name: "1차 측정",
      startIndex: 0,
      endIndex: records.length - 1,
      startTime: formatDateTime(records[0].timestamp),
      endTime: formatDateTime(records[records.length - 1].timestamp),
    };
    
    onSessionsChange([defaultSession]);
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-primary" />
            측정 회차 관리
          </CardTitle>
          {sessions.length === 0 && records.length > 0 && (
            <Button size="sm" variant="outline" onClick={createDefaultSessions}>
              기본 세션 생성
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            측정 회차를 추가하여 데이터를 분리하세요
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="p-3 rounded-lg border bg-background/50 space-y-3"
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
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">시작 인덱스</Label>
                    <Input
                      type="number"
                      value={session.startIndex}
                      min={0}
                      max={records.length - 1}
                      onChange={(e) => updateSession(session.id, { 
                        startIndex: Math.max(0, parseInt(e.target.value) || 0) 
                      })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">종료 인덱스</Label>
                    <Input
                      type="number"
                      value={session.endIndex}
                      min={session.startIndex}
                      max={records.length - 1}
                      onChange={(e) => updateSession(session.id, { 
                        endIndex: Math.min(records.length - 1, parseInt(e.target.value) || 0) 
                      })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{session.startTime} ~ {session.endTime}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {records.length > 0 && (
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="회차 이름 (예: 1차 측정)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="h-9"
            />
            <Button size="sm" onClick={addSession} className="shrink-0">
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
