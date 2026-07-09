// 카드 레이아웃 프리미티브
import * as React from "react";
import { cn } from "@/lib/utils";

/** 카드 컨테이너 */
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

/** 카드 헤더 영역 */
function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
  );
}

/** 카드 제목 */
function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

/** 카드 본문 */
function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent };
