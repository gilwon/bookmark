// 프롬프트 신규 등록
import { PromptEditor } from "@/components/prompts/prompt-editor";

export default function NewPromptPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">새 프롬프트</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          제목·목차·사용 상황과 1차/2차 프롬프트 본문을 입력하세요.
        </p>
      </div>
      <PromptEditor mode="create" />
    </div>
  );
}
