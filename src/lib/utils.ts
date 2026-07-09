// className 병합 유틸 (clsx + tailwind-merge)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스 충돌을 안전하게 병합한다. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
