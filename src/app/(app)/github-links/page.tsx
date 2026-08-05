// 다솔인의 GitHub 링크 120개를 제공하는 정적 목록 페이지
import { GithubLinksList } from "@/components/github-links/github-links-list";
import githubLinks from "@/data/github-links.json";

export default function GithubLinksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GitHub 링크</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude·Codex 실무에 쓰는 링크 120개를 정리했습니다. 출처는{" "}
          <a
            href="https://dasolin.net/tips/github-links"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            다솔인의 GitHub 링크 모음
          </a>
          입니다.
        </p>
      </div>
      <GithubLinksList items={githubLinks} />
    </div>
  );
}
