// 카드 레이아웃 프리미티브
import * as React from "react";
import { cn } from "@/lib/utils";

/** 카드 컨테이너 — 얇은 헤어라인 위의 평면 표면 */
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground transition-colors hover:border-[color-mix(in_srgb,var(--foreground)_18%,var(--border))]",
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
    <div className={cn("flex flex-col gap-1 p-3.5", className)} {...props} />
  );
}

/** 카드 제목 */
function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-sm font-medium leading-snug tracking-[-0.011em]",
        className
      )}
      {...props}
    />
  );
}

/** 카드 본문 */
function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-3.5 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent };
