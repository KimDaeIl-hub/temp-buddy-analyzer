import { useMemo } from "react";
import { DataFile, ResultFilter as ResultFilterType } from "@/types/file";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter, CheckSquare, Square } from "lucide-react";

interface ResultFilterProps {
  files: DataFile[];
  filters: ResultFilterType[];
  onFiltersChange: (filters: ResultFilterType[]) => void;
}

export function ResultFilter({ files, filters, onFiltersChange }: ResultFilterProps) {
  // Generate all possible filter combinations
  const allFilterItems = useMemo(() => {
    const items: ResultFilterType[] = [];
    
    files.forEach(file => {
      file.loggers.forEach(logger => {
        if (!logger.type) return; // Only configured loggers
        
        file.sessions.forEach(session => {
          items.push({
            fileId: file.id,
            loggerId: logger.id,
            sessionId: session.id,
            enabled: true,
          });
        });
      });
    });
    
    return items;
  }, [files]);

  // Initialize filters if empty
  const currentFilters = useMemo(() => {
    if (filters.length === 0 && allFilterItems.length > 0) {
      return allFilterItems;
    }
    
    // Merge new items with existing filters
    return allFilterItems.map(item => {
      const existing = filters.find(
        f => f.fileId === item.fileId && 
             f.loggerId === item.loggerId && 
             f.sessionId === item.sessionId
      );
      return existing || item;
    });
  }, [filters, allFilterItems]);

  const toggleFilter = (fileId: string, loggerId: string, sessionId: number) => {
    const updated = currentFilters.map(f => {
      if (f.fileId === fileId && f.loggerId === loggerId && f.sessionId === sessionId) {
        return { ...f, enabled: !f.enabled };
      }
      return f;
    });
    onFiltersChange(updated);
  };

  const selectAll = () => {
    onFiltersChange(currentFilters.map(f => ({ ...f, enabled: true })));
  };

  const deselectAll = () => {
    onFiltersChange(currentFilters.map(f => ({ ...f, enabled: false })));
  };

  const enabledCount = currentFilters.filter(f => f.enabled).length;

  if (allFilterItems.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4 text-primary" />
            결과 필터
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {enabledCount}/{currentFilters.length}개 선택
            </Badge>
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="w-4 h-4 mr-1" />
              전체 선택
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              <Square className="w-4 h-4 mr-1" />
              전체 해제
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-64 overflow-y-auto">
          {files.map(file => {
            const fileFilters = currentFilters.filter(f => f.fileId === file.id);
            if (fileFilters.length === 0) return null;
            
            return (
              <div key={file.id} className="space-y-2">
                <div className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Badge variant="outline">{file.name}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                  {fileFilters.map(filter => {
                    const logger = file.loggers.find(l => l.id === filter.loggerId);
                    const session = file.sessions.find(s => s.id === filter.sessionId);
                    if (!logger || !session) return null;
                    
                    const key = `${filter.fileId}-${filter.loggerId}-${filter.sessionId}`;
                    
                    return (
                      <div key={key} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                        <Checkbox
                          id={key}
                          checked={filter.enabled}
                          onCheckedChange={() => toggleFilter(filter.fileId, filter.loggerId, filter.sessionId)}
                        />
                        <Label htmlFor={key} className="text-xs cursor-pointer flex-1">
                          <span className="font-medium">{logger.name}</span>
                          <span className="text-muted-foreground"> · {session.name}</span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
