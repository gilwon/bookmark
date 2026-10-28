// 김스듴 가이드의 본문과 원문 링크를 보여준다.
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideBody } from "@/components/sdk-guides/guide-body";
import { buttonVariants } from "@/components/ui/button";
import { getSdkGuideBody } from "@/lib/sdk-guide-body";
import { getSdkGuide } from "@/lib/sdk-guides";
import { cn } from "@/lib/utils";

export default async function SdkGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getSdkGuide(slug);
  if (!guide) notFound();
  const body = getSdkGuideBody(slug);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/sdk-guides" className="inline-flex min-h-11 items-center gap-1 rounded text-sm text-muted-foreground hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />가이드 목록으로
      </Link>
      <article className="space-y-6">
        <header className="space-y-3">
          <h1 className="break-words text-xl font-semibold leading-relaxed tracking-[-0.02em]">{guide.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="text-indigo-600 dark:text-indigo-400">{guide.category}</span>
            {guide.tool && <span>{guide.tool}</span>}
            <time dateTime={guide.publishedAt}>{guide.publishedAt.slice(0, 10)}</time>
          </div>
          {guide.tags.length > 0 && <ul className="flex flex-wrap gap-2" aria-label="태그">{guide.tags.map((tag) => <li key={tag} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</li>)}</ul>}
        </header>
        <div className="space-y-6 border-t border-border pt-6">
          {body ? <GuideBody markdown={body} /> : null}
          <a href={guide.sourceUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 h-auto whitespace-normal")}>
            원문에서 가이드 읽기<ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">새 탭에서 열기</span>
          </a>
        </div>
      </article>
    </div>
  );
}
