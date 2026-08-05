// 로컬 PDF 파일을 브라우저에서 바로 확인하는 페이지
import { PdfViewer } from "@/components/pdf-viewer/pdf-viewer";

export default function PdfViewerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">PDF 뷰어</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF 파일을 선택하면 서버 저장 없이 바로 확인할 수 있습니다.
        </p>
      </div>
      <PdfViewer />
    </div>
  );
}
