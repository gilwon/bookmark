// 태그/배지 UI
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-medium leading-5 transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-indigo-600/12 text-indigo-700 dark:bg-indigo-500/18 dark:text-indigo-300",
        secondary: "border-border bg-muted text-muted-foreground",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/** 태그·언어·카테고리 표시용 배지 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
