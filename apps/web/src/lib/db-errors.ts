import type { PostgrestError } from "@supabase/supabase-js";

/**
 * User-facing message for a failed database call. Our RPCs and triggers raise Indonesian
 * messages for rule violations (42501/23514/22023/P0002), which are safe to show as-is.
 */
export function dbMessage(error: PostgrestError | null, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "23505") return "Data yang sama sudah ada.";
  if (error.code === "42501" && /row-level security|permission denied/i.test(error.message)) {
    return "Anda tidak memiliki hak untuk tindakan ini.";
  }
  if (["42501", "23514", "22023", "P0002"].includes(error.code ?? "") && error.message && error.message !== "forbidden") {
    return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
  }
  if (error.code === "42501") return "Anda tidak memiliki hak untuk tindakan ini.";
  return fallback;
}
