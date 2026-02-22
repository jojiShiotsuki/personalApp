import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AxiosError } from "axios";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract a user-facing error message from an API error (axios or generic). */
export function getErrorMessage(error: unknown, fallback = 'An error occurred. Please try again.'): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.detail || error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
