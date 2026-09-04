// 스레드 카피 목록
import { CopyList } from "@/components/copies/copy-list";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import { rowToThreadCopy } from "@/lib/thread-copy";

export const runtime = "nodejs";

export default async function CopiesPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const rows = await store.listThreadCopies(userId);
  const list = rows.map(rowToThreadCopy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">카피</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          짧은 SNS 글을 모아 두고, 줄바꿈을 유지한 채로 다시 읽고 한 번에
          복사합니다.
        </p>
      </div>
      <CopyList copies={list} />
    </div>
  );
}
