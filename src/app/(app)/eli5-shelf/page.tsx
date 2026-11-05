// eli5 설명서 서가 목록 페이지.
import { ShelfList } from "@/components/eli5-shelf/shelf-list";
import { listEli5Shelf } from "@/lib/eli5-shelf";

export default function Eli5ShelfPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">eli5 설명서</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          GitHub 레포를 그림과 쉬운 말로 풀어 쓴 설명서 모음입니다. 카드를 누르면 문서가 열립니다.
        </p>
      </div>
      <ShelfList items={listEli5Shelf()} />
    </div>
  );
}
