import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export { cn } from "@/lib/utils";

export function cnMerge(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
