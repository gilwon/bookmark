// heyjames.ai/skills 카탈로그 목록 페이지
import { HeyjamesSkillList } from "@/components/skills/heyjames-skill-list";
import { listHeyjamesSkills } from "@/lib/heyjames-skills";

export const runtime = "nodejs";

export default function SkillsPage() {
  const items = listHeyjamesSkills();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">스킬</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude Code 스킬·MCP·도구 모음 (출처: heyjames.ai)
        </p>
      </div>
      <HeyjamesSkillList items={items} />
    </div>
  );
}
