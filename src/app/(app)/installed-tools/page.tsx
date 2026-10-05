// Claude·Codex·Grok·Gemini 설치 현황(스킬·플러그인) 페이지
import { InstalledToolsView } from "@/components/installed-tools/installed-tools-view";
import { parseSortMode, parseTag } from "@/lib/installed-tools";
import { getInstalledToolsLatest } from "@/lib/installed-tools-source";

// 동기화 직후 router.refresh() 로 새 스냅샷을 보이도록 캐시하지 않는다
export const dynamic = "force-dynamic";

export default async function InstalledToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; sort?: string; tag?: string }>;
}) {
  const { tool, sort, tag } = await searchParams;
  const { generatedAt, tools } = await getInstalledToolsLatest();
  // 알 수 없는 탭이면 첫 탭(Claude)으로 보인다
  const activeId = tools.some((t) => t.id === tool) ? tool! : tools[0]?.id ?? "";
  // 알 수 없는 정렬 값이면 이름순
  const sortMode = parseSortMode(sort);
  // 알 수 없는 용도 값이면 선택 없음
  const selectedTag = parseTag(tag);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">설치 현황</h1>
        {/* 스냅샷 시각은 뷰 상단 동기화 줄에서 한국 시간으로 보인다 */}
        <p className="mt-1 text-sm text-muted-foreground">도구별로 설치된 스킬과 플러그인</p>
      </div>
      {/* 탭이 바뀌면 key 로 다시 마운트해 검색어를 비운다. 정렬·용도는 URL 에 있어 유지된다 */}
      <InstalledToolsView
        key={activeId}
        tools={tools}
        activeId={activeId}
        sortMode={sortMode}
        selectedTag={selectedTag}
        generatedAt={generatedAt}
      />
    </div>
  );
}
