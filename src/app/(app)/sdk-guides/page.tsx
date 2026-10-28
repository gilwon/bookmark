// 김스듴 가이드 목록과 검색·분류 도구를 보여준다.
import { GuideList } from "@/components/sdk-guides/guide-list";
import { listSdkGuides, SDK_GUIDES_SOURCE } from "@/lib/sdk-guides";

export default function SdkGuidesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">김스듴 가이드</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          업무와 AI 도구별로 가이드를 찾아보세요. 출처는{" "}
          <a href={SDK_GUIDES_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded underline underline-offset-4 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-indigo-400">낭만빌더 김스듴</a>입니다.
        </p>
      </div>
      <GuideList guides={listSdkGuides()} />
    </div>
  );
}
