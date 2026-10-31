// 신영선 자료 한 편의 본문을 앱 안에서 보여 준다.
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveBody } from "@/components/yeongseon-archive/archive-body";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getYeongseonArchiveBody } from "@/lib/yeongseon-archive-body";
import { articleUrl, getYeongseonArchiveItem } from "@/lib/yeongseon-archive";
import { cn } from "@/lib/utils";

function queryValue(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

export default async function YeongseonArchiveItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string | string[];
    source?: string | string[];
    topic?: string | string[];
    shown?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const item = getYeongseonArchiveItem(id);
  if (!item) notFound();
  const body = getYeongseonArchiveBody(id);

  const back = new URLSearchParams();
  const q = queryValue(query.q);
  const source = queryValue(query.source);
  const topic = queryValue(query.topic);
  const shown = queryValue(query.shown);
  if (q) back.set("q", q);
  if (source) back.set("source", source);
  if (topic) back.set("topic", topic);
  if (shown) back.set("shown", shown);
  const backQs = back.toString();
  const backHref = backQs ? `/yeongseon-archive?${backQs}` : "/yeongseon-archive";

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex min-h-11 items-center gap-1 rounded text-sm text-muted-foreground hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        자료 목록으로
      </Link>
      <article className="space-y-6">
        <Badge>{`${item.publishedAt} · ${item.source} · ${item.level}`}</Badge>
        <div className="space-y-6 border-t border-border pt-6">
          <div className="space-y-3">
            <h1 className="break-words text-xl font-semibold leading-snug">{item.title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            <p className="text-xs text-muted-foreground">{item.tags.join(" · ")}</p>
          </div>
          {body ? (
            <ArchiveBody html={body} />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              본문을 아직 가져오지 못했습니다.{" "}
              <a
                href={articleUrl(item.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                원문
              </a>
            </p>
          )}
          <a
            href={articleUrl(item.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 h-auto whitespace-normal")}
          >
            원문에서 읽기
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">새 탭에서 열기</span>
          </a>
        </div>
      </article>
    </div>
  );
}
