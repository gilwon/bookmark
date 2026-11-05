// 트렌드코어 스킬공유자료실 목록과 검색·분류 도구를 보여준다.
import { LabList } from "@/components/trendcore-lab/lab-list";
import { listTrendcoreLab, TRENDCORE_LAB_SOURCE } from "@/lib/trendcore-lab";

export default function TrendcoreLabPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">스킬공유자료실</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          트렌드코어 랩의 자료를 사이트에 올라온 그대로 모았습니다. 출처는{" "}
          <a href={TRENDCORE_LAB_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded underline underline-offset-4 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400">트렌드코어 스킬공유자료실</a>입니다.
        </p>
      </div>
      <LabList items={listTrendcoreLab()} />
    </div>
  );
}
