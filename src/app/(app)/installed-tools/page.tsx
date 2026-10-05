// Claude·Codex·Grok·Gemini 설치 현황(스킬·플러그인) 페이지
import { InstalledToolsView } from "@/components/installed-tools/installed-tools-view";
import { getInstalledTools, parseSortMode } from "@/lib/installed-tools";

export default async function InstalledToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string; sort?: string }>;
}) {
  const { generatedAt, tools } = getInstalledTools();
  const { tool, sort } = await searchParams;
  // 알 수 없는 탭이면 첫 탭(Claude)으로 보인다
  const activeId = tools.some((t) => t.id === tool) ? tool! : tools[0]?.id ?? "";
  // 알 수 없는 정렬 값이면 이름순
  const sortMode = parseSortMode(sort);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">설치 현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          도구별로 설치된 스킬과 플러그인 (스냅샷{" "}
          {new Date(generatedAt).toLocaleDateString("ko-KR")})
        </p>
      </div>
      {/* 탭이 바뀌면 key 로 다시 마운트해 검색어를 비운다. 정렬은 URL 에 있어 유지된다 */}
      <InstalledToolsView key={activeId} tools={tools} activeId={activeId} sortMode={sortMode} />
    </div>
  );
}
