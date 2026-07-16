// heyjames.ai/skills 카탈로그 단건 상세 페이지
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHeyjamesSkillBySlug, heyjamesSkillTypeLabel } from "@/lib/heyjames-skills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

type Params = Promise<{ slug: string }>;

export default async function SkillDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const item = getHeyjamesSkillBySlug(slug);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/skills"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-indigo-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        목록으로
      </Link>

      <div className="space-y-2">
        <Badge variant="secondary">{heyjamesSkillTypeLabel(item.type)}</Badge>
        <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
        <p className="text-sm text-muted-foreground">
          조회 {item.views.toLocaleString()}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">
        {item.description}
      </p>

      <a
        href={`https://heyjames.ai/skills/${item.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        <Button type="button" variant="secondary">
          <ExternalLink className="h-4 w-4" />
          heyjames에서 원본 보기
        </Button>
      </a>
    </div>
  );
}
