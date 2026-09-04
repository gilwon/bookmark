// 공통 멀티라인 텍스트 입력
import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** 테마 토큰을 쓰는 텍스트에어리어 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[76px] w-full rounded-md border border-border bg-input px-2.5 py-2 text-sm leading-relaxed text-foreground transition-colors placeholder:text-[var(--placeholder)] hover:border-[color-mix(in_srgb,var(--foreground)_18%,var(--border))] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
