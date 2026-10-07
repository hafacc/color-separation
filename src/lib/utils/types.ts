import type { RgbU32 } from "./color";

export interface ColorState {
  name: string;
  active: boolean;
  remap: RgbU32 | undefined;
  order: number;
}

export type Ordering = "light-to-dark" | "manual" | "auto";
export const ORDERINGS: readonly Ordering[] = [
  "light-to-dark",
  "manual",
  "auto",
];
export function isOrdering(value: string): value is Ordering {
  return (ORDERINGS as readonly string[]).includes(value);
}

export type Action =
  | { action: "add"; color: RgbU32; name: string }
  | { action: "remove"; color: RgbU32 }
  | { action: "toggle"; color: RgbU32 }
  | { action: "remap"; color: RgbU32; remap: RgbU32 }
  | { action: "clear" };
