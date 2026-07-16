// 빈 프롬프트 문서를 만든 뒤 노션형 편집 화면으로 이동한다
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function NewPromptButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createPrompt() {
    setCreating(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "제목 없는 프롬프트",
          sections: [{ title: "프롬프트 문서", body: "" }],
        }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const prompt = (await res.json()) as { id: string };
      router.push(`/prompts/${prompt.id}/edit`);
      router.refresh();
    } catch {
      alert("프롬프트 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button onClick={() => void createPrompt()} disabled={creating}>
      <Plus className="h-4 w-4" />
      {creating ? "생성 중…" : "빈 프롬프트 만들기"}
    </Button>
  );
}
