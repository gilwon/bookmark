// 인증 가드가 있는 앱 레이아웃
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { auth } from "@/lib/auth";

/** 로그인하지 않은 사용자는 /login 으로 보낸다. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
