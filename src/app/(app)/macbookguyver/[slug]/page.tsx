// 맥북가이버 회차 상세 — 한눈에 보기 · 목차 · 내 정보로 바꾸기 · 프롬프트
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeGuide } from "@/components/macbookguyver/episode-guide";
import { getEpisodeBySlug } from "@/lib/macbookguyver";

type Params = Promise<{ slug: string }>;

export default async function MacbookguyverEpisodePage({ params }: { params: Params }) {
  const { slug } = await params;
  const episode = getEpisodeBySlug(slug);
  if (!episode) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/macbookguyver"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-indigo-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        목록으로
      </Link>
      <div className="space-y-2">
        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
          {episode.number}화 · {episode.guest} · {episode.date}
        </p>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{episode.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{episode.summary}</p>
      </div>
      <EpisodeGuide episode={episode} />
    </div>
  );
}
