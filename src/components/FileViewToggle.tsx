import { memo, useCallback, useMemo } from "react";
import { DataFile, FileViewMode } from "@/types/file";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, SplitSquareVertical } from "lucide-react";

interface FileViewToggleProps {
  files: DataFile[];
  viewMode: FileViewMode;
  onViewModeChange: (mode: FileViewMode) => void;
}

export const FileViewToggle = memo(function FileViewToggle({ 
  files, 
  viewMode, 
  onViewModeChange 
}: FileViewToggleProps) {
  const firstFileId = useMemo(() => files[0]?.id, [files]);
  
  const handleCombinedClick = useCallback(() => {
    onViewModeChange({ mode: 'combined' });
  }, [onViewModeChange]);

  const handleIndividualClick = useCallback(() => {
    onViewModeChange({ 
      mode: 'individual', 
      selectedFileId: viewMode.selectedFileId || firstFileId 
    });
  }, [onViewModeChange, viewMode.selectedFileId, firstFileId]);

  const handleFileSelect = useCallback((fileId: string) => {
    onViewModeChange({ mode: 'individual', selectedFileId: fileId });
  }, [onViewModeChange]);

  if (files.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-card shrink-0">
      <div className="flex gap-1">
        <Button
          variant={viewMode.mode === 'combined' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 whitespace-nowrap"
          onClick={handleCombinedClick}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">전체</span>
        </Button>
        <Button
          variant={viewMode.mode === 'individual' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 whitespace-nowrap"
          onClick={handleIndividualClick}
        >
          <SplitSquareVertical className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">개별</span>
        </Button>
      </div>
      
      {viewMode.mode === 'individual' && (
        <Select
          value={viewMode.selectedFileId || firstFileId}
          onValueChange={handleFileSelect}
        >
          <SelectTrigger className="w-32 sm:w-48 h-8">
            <SelectValue placeholder="파일 선택" />
          </SelectTrigger>
          <SelectContent>
            {files.map((file) => (
              <SelectItem key={file.id} value={file.id}>
                <span className="truncate">{file.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
});
