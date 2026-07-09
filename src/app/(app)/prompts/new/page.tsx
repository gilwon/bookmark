// 프롬프트 신규 등록
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PromptEditor } from "@/components/prompts/prompt-editor";

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
      <PromptEditor mode="create" />
    </div>
  );
}
