// 선택 항목 병렬 삭제 헬퍼

/**
 * id 목록을 DELETE endpoint 로 보낸다.
 * endpoint 예: (id) => `/api/bookmarks/${id}`
 */
export async function bulkDeleteByIds(
  ids: string[],
  endpoint: (id: string) => string
): Promise<{ ok: number; fail: number }> {
  if (ids.length === 0) return { ok: 0, fail: 0 };

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const res = await fetch(endpoint(id), { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      return id;
    })
  );

  let ok = 0;
  let fail = 0;
  for (const r of results) {
    if (r.status === "fulfilled") ok += 1;
    else fail += 1;
  }
  return { ok, fail };
}
