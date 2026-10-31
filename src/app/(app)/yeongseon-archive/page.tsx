// 신영선 자료 아카이브 목록과 원문 링크를 보여 준다.
import { Suspense } from "react";
import { ArchiveList } from "@/components/yeongseon-archive/archive-list";
import { YEONGSEON_ARCHIVE_SOURCE } from "@/lib/yeongseon-archive";

export default function YeongseonArchivePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">자료 아카이브</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          직접 써본 AI 활용법과 자료를 모았습니다. 출처는{" "}
          <a
            href={YEONGSEON_ARCHIVE_SOURCE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded underline underline-offset-4 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400"
          >
            신영선 자료 아카이브
          </a>
          입니다.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">자료를 불러오는 중.</p>}>
        <ArchiveList />
      </Suspense>
    </div>
  );
}
