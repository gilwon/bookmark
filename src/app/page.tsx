// 루트 → 북마크 페이지로 리다이렉트
import { redirect } from "next/navigation";

/** 홈은 북마크 목록으로 보낸다. */
export default function HomePage() {
  redirect("/bookmarks");
}
