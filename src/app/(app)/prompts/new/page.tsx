// 프롬프트 신규 등록
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { NewPromptButton } from "@/components/prompts/new-prompt-button";

export default function NewPromptPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/prompts"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">새 프롬프트</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            제목·목차·사용 상황과 프롬프트 본문을 입력하세요.
          </p>
        </div>
      </div>
      <div className="rounded-md border border-dashed border-border px-5 py-12 text-center">
        <h2 className="text-base font-semibold">빈 노션형 프롬프트 문서</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          제목을 입력하고 / 메뉴로 제목, 코드, 체크리스트, 콜아웃 등을 추가할 수 있습니다.
        </p>
        <div className="mt-5">
          <NewPromptButton />
        </div>
      </div>
    </div>
  );
}
