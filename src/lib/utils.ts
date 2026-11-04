import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function formatPct(val: number): string {
  return `${val.toFixed(1)}%`;
}
