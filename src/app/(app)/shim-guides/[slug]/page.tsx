// 심팀장 자료 한 편의 본문과 원문 링크를 보여 준다.
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideBody } from "@/components/sdk-guides/guide-body";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getShimGuideBody } from "@/lib/shim-guide-body";
import { getShimGuide } from "@/lib/shim-guides";
import { cn } from "@/lib/utils";

export default async function ShimGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getShimGuide(slug);
  if (!guide) notFound();
  const body = getShimGuideBody(slug);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/shim-guides" className="inline-flex min-h-11 items-center gap-1 rounded text-sm text-muted-foreground hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />자료 목록으로
      </Link>
      <article className="space-y-6">
        <Badge>{guide.episode}</Badge>
        <div className="space-y-6 border-t border-border pt-6">
          {body ? <GuideBody markdown={body} /> : null}
          <a href={guide.sourceUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 h-auto whitespace-normal")}>
            원문에서 읽기<ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">새 탭에서 열기</span>
          </a>
        </div>
      </article>
    </div>
  );
}
