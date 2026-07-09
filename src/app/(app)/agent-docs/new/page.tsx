// 에이전트 문서 신규 작성 (초안 — 저장 버튼으로만 DB 반영)
"use client";

import { AgentDocEditor } from "@/components/agent-docs/agent-doc-editor";

/** 초안 편집 화면 */
export default function NewAgentDocPage() {
  return (
    <div className="space-y-2">
      <AgentDocEditor mode="create" />
    </div>
  );
}
