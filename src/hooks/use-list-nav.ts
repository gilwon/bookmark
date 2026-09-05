// 목록 검색어·페이지를 URL query로 맞춘다.
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function useListNav(serverQ: string, _serverPage: number) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(serverQ);

  useEffect(() => {
    setQ(serverQ);
  }, [serverQ]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (q.trim() === serverQ) return;
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 280);
    return () => window.clearTimeout(t);
  }, [q, serverQ, pathname, router]);

  function goPage(page: number) {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return { q, setQ, goPage };
}
