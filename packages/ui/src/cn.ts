import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Shared className-merging helper for shadcn/ui components, used by both this package and apps/web. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
