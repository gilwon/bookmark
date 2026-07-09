// 커스텀 페이지 목록 + 새 페이지 생성
"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CustomPage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** 페이지 목록을 렌더하고 생성/삭제를 처리한다. */
export function PageList({ pages }: { pages: CustomPage[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  /** 빈 페이지를 생성한 뒤 에디터로 이동한다. */
  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "제목 없는 페이지" }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const page = await res.json();
      router.push(`/pages/${page.id}`);
      router.refresh();
    } catch {
      alert("페이지 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  /** 페이지 삭제 */
  async function handleDelete(id: string) {
    if (!confirm("이 페이지를 삭제할까요?")) return;
    const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? "생성 중…" : "새 페이지"}
        </Button>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 py-16 text-center text-sm text-zinc-500">
          아직 페이지가 없습니다. 새 페이지를 만들어 보세요.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pages.map((page) => (
            <Card
              key={page.id}
              className="group transition-colors hover:border-zinc-700"
            >
              <CardContent className="flex items-center gap-3 p-4">
                <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/pages/${page.id}`}
                    className="block truncate font-medium hover:text-indigo-300"
                  >
                    {page.title}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    수정 {new Date(page.updatedAt).toLocaleString("ko-KR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 text-red-400"
                  onClick={() => handleDelete(page.id)}
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
