import "server-only";
import { unstable_cache } from "next/cache";
import { getAdminSupabase } from "@/auth/admin";
import {
  GENERATION_SPEED,
  sitePace,
  type GenerationSample,
} from "@/lib/custom-practice/estimate";

/** Recomputed at most this often: a new median doesn't need to be instant. */
const PACE_CACHE_SECONDS = 60 * 60;

/**
 * The site's seconds per sentence for getting a practice ready (D142):
 * the median over the recent practices whose real time was recorded.
 * Null without the secret key (development, E2E) or enough measurements.
 */
export const getGenerationPace = unstable_cache(
  async (): Promise<number | null> => {
    const supabase = getAdminSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("practices")
      .select("generation_seconds, practice_sentences(count)")
      .not("generation_seconds", "is", null)
      .order("created_at", { ascending: false })
      .limit(GENERATION_SPEED.siteSamples);
    if (error || !data) return null;
    const samples: GenerationSample[] = data.map((row) => ({
      seconds: row.generation_seconds ?? 0,
      sentences: row.practice_sentences[0]?.count ?? 0,
    }));
    return sitePace(samples);
  },
  ["generation-pace:v1"],
  { revalidate: PACE_CACHE_SECONDS },
);
