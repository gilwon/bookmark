// Git 명령어 치트시트 카탈로그
import { GitCheatsheetList } from "@/components/git/git-cheatsheet-list";
import { listGitCheatsheet } from "@/lib/git-cheatsheet";

export const runtime = "nodejs";

export default function GitPage() {
  const items = listGitCheatsheet();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Git</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          자주 쓰는 Git 명령어 모음
        </p>
      </div>
      <GitCheatsheetList items={items} />
    </div>
  );
}
