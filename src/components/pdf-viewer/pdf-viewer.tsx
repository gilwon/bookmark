// 브라우저에서 PDF 파일을 선택해 즉시 미리보는 뷰어
"use client";

import { FileText, RotateCcw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Preview = {
  name: string;
  size: number;
  url: string;
};

/** PDF를 서버에 전송하지 않고 브라우저의 기본 PDF 뷰어로 표시한다. */
export function PdfViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  async function selectFile(file: File) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("PDF 파일만 업로드할 수 있습니다.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const signature = [0x25, 0x50, 0x44, 0x46, 0x2d];
    const isPdf = header.some((_, index) =>
      signature.every((byte, offset) => header[index + offset] === byte)
    );
    if (!isPdf) {
      setError("PDF 파일만 업로드할 수 있습니다.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreview({ name: file.name, size: file.size, url });
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function reset() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setPreview(null);
    setError(null);
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="PDF 파일 선택"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void selectFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragOver
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-border bg-card/40 hover:border-indigo-400/60 hover:bg-muted/30"
        )}
      >
        <Upload
          className={cn(
            "h-7 w-7",
            dragOver ? "text-indigo-500" : "text-muted-foreground"
          )}
        />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {dragOver ? "여기에 놓으세요" : "PDF를 끌어다 놓거나 클릭해서 선택"}
          </p>
          <p className="text-xs text-muted-foreground">
            파일은 서버에 업로드되지 않고 이 브라우저에서만 열립니다.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void selectFile(file);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {preview && (
        <section className="space-y-3" aria-label="PDF 미리보기">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{preview.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {(preview.size / 1024 / 1024).toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })}
                MB
              </span>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </Button>
          </div>

          <iframe
            src={preview.url}
            title={`${preview.name} 미리보기`}
            className="h-[70vh] min-h-[480px] w-full rounded-xl border border-border bg-white"
          />
        </section>
      )}
    </div>
  );
}
