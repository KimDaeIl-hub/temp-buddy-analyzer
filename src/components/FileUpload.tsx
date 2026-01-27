import { useCallback } from "react";
import { Upload, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { readFileWithEncoding } from "@/utils/csvParser";

interface FileUploadProps {
  onFileLoad: (content: string, fileName: string) => void;
}

export function FileUpload({ onFileLoad }: FileUploadProps) {
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const content = await readFileWithEncoding(file);
      onFileLoad(content, file.name);
    },
    [onFileLoad]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file) return;

      const content = await readFileWithEncoding(file);
      onFileLoad(content, file.name);
    },
    [onFileLoad]
  );

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
  };

  return (
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
                TMI Qlever 데이터로거 CSV 파일을 지원합니다
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
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </CardContent>
    </Card>
  );
}
