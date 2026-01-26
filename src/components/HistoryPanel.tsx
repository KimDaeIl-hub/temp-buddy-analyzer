import { SessionHistory } from "@/types/history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileText, Clock, Layers, Trash2, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface HistoryPanelProps {
  historyItems: SessionHistory[];
  onLoadHistory: (history: SessionHistory) => void;
  onDeleteHistory: (historyId: string) => void;
  onClearHistory: () => void;
}

export function HistoryPanel({ 
  historyItems, 
  onLoadHistory, 
  onDeleteHistory,
  onClearHistory 
}: HistoryPanelProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (historyItems.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-primary" />
            최근 분석 기록
          </CardTitle>
          {historyItems.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                  전체 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>모든 기록을 삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 작업은 되돌릴 수 없습니다. 모든 분석 기록이 영구적으로 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearHistory} className="bg-destructive text-destructive-foreground">
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {historyItems.map((history) => (
              <div 
                key={history.id} 
                className="p-3 rounded-lg border bg-background/50 space-y-2 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{history.fileName}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7"
                      onClick={() => onLoadHistory(history)}
                      title="불러오기"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDeleteHistory(history.id)}
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(history.savedAt)}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    <Layers className="w-3 h-3 mr-1" />
                    {history.sessions.length}개 회차
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {history.loggerConfigs.filter(l => l.type).map((logger) => (
                    <Badge 
                      key={logger.loggerId} 
                      variant="outline" 
                      className="text-xs"
                    >
                      {logger.loggerName.length > 15 
                        ? logger.loggerName.slice(0, 15) + '...' 
                        : logger.loggerName}
                      <span className="ml-1 opacity-70">
                        ({logger.type === 'hotwater' ? '열수' : '품온'})
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
