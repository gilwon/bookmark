// 에러·404 공통 안내 패널
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RecoveryPanel({
  title,
  description,
  digest,
  onRetry,
  homeHref = "/dashboard",
}: {
  title: string;
  description: string;
  digest?: string;
  onRetry?: () => void;
  homeHref?: string;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <h1 className="text-lg font-medium tracking-[-0.02em]">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {digest ? (
          <p className="text-xs text-muted-foreground">코드 {digest}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {onRetry ? (
            <Button
              type="button"
              size="lg"
              className="h-11 min-w-[7rem]"
              onClick={onRetry}
            >
              다시 시도
            </Button>
          ) : null}
          <Link
            href={homeHref}
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "h-11 min-w-[7rem]"
            )}
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
