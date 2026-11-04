import type { Json } from "@/lib/supabase/database.types";
import type { AiCache } from "@/lib/custom-practice/notes";
import type { Supabase } from "@/lib/supabase/browser";

/**
 * The language-model cache in the ai_cache table (D27). Server only, with
 * the secret key: users can't read or edit it.
 */
export function supabaseAiCache(admin: Supabase): AiCache {
  return {
    async get(hash) {
      const { data, error } = await admin
        .from("ai_cache")
        .select("result")
        .eq("hash", hash)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.result ?? null;
    },
    async set(hash, kind, result) {
      const { error } = await admin
        .from("ai_cache")
        .upsert(
          { hash, kind, result: result as Json },
          { onConflict: "hash", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    },
  };
}
