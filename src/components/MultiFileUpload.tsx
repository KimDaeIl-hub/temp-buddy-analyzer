import { useCallback } from "react";
import { Upload, FileText, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readFileWithEncoding, parseCSVContent } from "@/utils/csvParser";
import { DataFile } from "@/types/file";

interface MultiFileUploadProps {
  files: DataFile[];
  onFilesChange: (files: DataFile[], contents?: Map<string, string>) => void;
}

export function MultiFileUpload({ files, onFilesChange }: MultiFileUploadProps) {
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = event.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;

      const newFiles: DataFile[] = [];
      const newContents = new Map<string, string>();
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const content = await readFileWithEncoding(file);
        const loggers = parseCSVContent(content);
        
        if (loggers.length > 0) {
          const fileId = `file-${Date.now()}-${i}`;
          newFiles.push({
            id: fileId,
            name: file.name,
            loggers,
            sessions: [],
            uploadedAt: new Date(),
          });
          newContents.set(fileId, content);
        }
      }
      
      // Merge with existing contents
      const allContents = new Map<string, string>();
      files.forEach(f => {
        // Keep existing file contents (not tracked in this component, will be handled by parent)
      });
      newContents.forEach((content, id) => {
        allContents.set(id, content);
      });
      
      onFilesChange([...files, ...newFiles], newContents);
      
      // Reset input
      event.target.value = '';
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const droppedFiles = event.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      const newFiles: DataFile[] = [];
      const newContents = new Map<string, string>();
      
      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i];
        if (!file.name.endsWith('.csv')) continue;
        
        const content = await readFileWithEncoding(file);
        const loggers = parseCSVContent(content);
        
        if (loggers.length > 0) {
          const fileId = `file-${Date.now()}-${i}`;
          newFiles.push({
            id: fileId,
            name: file.name,
            loggers,
            sessions: [],
            uploadedAt: new Date(),
          });
          newContents.set(fileId, content);
        }
      }
      
      onFilesChange([...files, ...newFiles], newContents);
    },
    [files, onFilesChange]
  );

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const removeFile = useCallback((fileId: string) => {
    onFilesChange(files.filter(f => f.id !== fileId));
  }, [files, onFilesChange]);

  return (
    <div className="space-y-4">
      <Card className="border-2 border-dashed border-primary/30 bg-card/50 hover:border-primary/50 transition-colors">
        <CardContent className="p-8">
          <label
            htmlFor="file-upload"
            className="cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">
                  CSV 파일을 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  TMI QLever 데이터로거 CSV 파일을 지원합니다 (여러 파일 선택 가능)
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>.csv 파일</span>
              </div>
            </div>
            <input
              id="file-upload"
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </CardContent>
      </Card>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">업로드된 파일 ({files.length}개)</h3>
            <label htmlFor="file-upload-add" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Plus className="w-4 h-4 mr-1" />
                  파일 추가
                </span>
              </Button>
              <input
                id="file-upload-add"
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
          <div className="grid gap-2">
            {files.map((file) => (
              <Card key={file.id} className="bg-card">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {file.loggers.length}개 로거
                        </Badge>
                        {file.sessions.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {file.sessions.length}개 회차
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFile(file.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
