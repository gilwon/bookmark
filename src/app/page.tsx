// 루트 → 대시보드로 리다이렉트
import { redirect } from "next/navigation";

/** 홈 진입 시 /dashboard 로 보낸다. */
export default function HomePage() {
  redirect("/dashboard");
}
