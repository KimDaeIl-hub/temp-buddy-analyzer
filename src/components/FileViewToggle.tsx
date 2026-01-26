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

export function FileViewToggle({ files, viewMode, onViewModeChange }: FileViewToggleProps) {
  if (files.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-card">
      <div className="flex gap-1">
        <Button
          variant={viewMode.mode === 'combined' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => onViewModeChange({ mode: 'combined' })}
        >
          <Layers className="w-4 h-4" />
          전체 보기
        </Button>
        <Button
          variant={viewMode.mode === 'individual' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => onViewModeChange({ 
            mode: 'individual', 
            selectedFileId: viewMode.selectedFileId || files[0]?.id 
          })}
        >
          <SplitSquareVertical className="w-4 h-4" />
          개별 보기
        </Button>
      </div>
      
      {viewMode.mode === 'individual' && (
        <Select
          value={viewMode.selectedFileId || files[0]?.id}
          onValueChange={(fileId) => onViewModeChange({ mode: 'individual', selectedFileId: fileId })}
        >
          <SelectTrigger className="w-48 h-8">
            <SelectValue placeholder="파일 선택" />
          </SelectTrigger>
          <SelectContent>
            {files.map((file) => (
              <SelectItem key={file.id} value={file.id}>
                {file.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
