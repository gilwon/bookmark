// 맥북가이버 회차별 자동화 가이드 목록
import { EpisodeList } from "@/components/macbookguyver/episode-list";
import { listEpisodes, MACBOOKGUYVER_HOME } from "@/lib/macbookguyver";

export default function MacbookguyverPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">맥북가이버</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          회차별 AI 업무 자동화 프롬프트 모음 (출처:{" "}
          <a href={MACBOOKGUYVER_HOME} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500">
            jocoding.net
          </a>
          )
        </p>
      </div>
      <EpisodeList episodes={listEpisodes()} />
    </div>
  );
}
