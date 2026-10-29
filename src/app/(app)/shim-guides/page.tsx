// 심팀장 자료실 목록과 출처 링크를 보여 준다.
import { GuideList } from "@/components/shim-guides/guide-list";
import { listShimGuides, SHIM_GUIDES_SOURCE } from "@/lib/shim-guides";

export default function ShimGuidesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">심팀장 자료실</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          영상에서 말한 자료를 사이트와 같은 순서로 모았습니다. 출처는{" "}
          <a href={SHIM_GUIDES_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded underline underline-offset-4 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400">심팀장 AI 자료실</a>
          입니다.
        </p>
      </div>
      <GuideList guides={listShimGuides()} />
    </div>
  );
}
