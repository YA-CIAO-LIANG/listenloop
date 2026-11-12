import {
  parseSavedFilter,
  practiceLibraryItem,
  videoLibraryItem,
  type LibraryItem,
} from "@/lib/library";
import {
  audioSeconds,
  LIBRARY_CACHE_SECONDS,
  LIBRARY_DEFAULT_DOCUMENT,
  LIBRARY_TAG,
} from "@/lib/library-config";
import {
  customPracticeId,
  parseCustomPracticeId,
} from "@/lib/practice-material";
import { getAllVideos } from "@/lib/video-library";
import { unstable_cache } from "next/cache";
import {
  listOfficialPracticesForEveryone,
  listPublicPracticesForEveryone,
} from "./public-practices";
import { getPublicSupabase } from "./public-supabase";
import { getServerSupabase } from "./server";
import { getSignedInUser } from "./session";

type Client = Awaited<ReturnType<typeof getServerSupabase>>;

/** How many people practice each material, by its id in links. */
export async function learnerCounts(
  client?: Client,
): Promise<Map<string, number>> {
  const supabase = client === undefined ? await getServerSupabase() : client;
  if (!supabase) return new Map();
  const { data, error } = await supabase.rpc("material_learner_counts");
  if (error) return new Map();
  return new Map(data.map((row) => [row.video_id, row.learners]));
}

/** Seconds of audio per practice ("p-<uuid>" ids); unknown ones are left out. */
export async function practiceSeconds(
  ids: readonly string[],
  client?: Client,
): Promise<Map<string, number>> {
  const uuids = ids.flatMap((id) => parseCustomPracticeId(id) ?? []);
  const supabase = client === undefined ? await getServerSupabase() : client;
  if (!supabase || uuids.length === 0) return new Map();
  const { data, error } = await supabase.rpc("practice_audio_bytes", {
    ids: uuids,
  });
  if (error) return new Map();
  const seconds = new Map<string, number>();
  for (const row of data) {
    const id = customPracticeId(row.practice_id);
    seconds.set(
      id,
      (seconds.get(id) ?? 0) + audioSeconds(row.bytes, row.mime_type),
    );
  }
  return seconds;
}

/**
 * The whole library (D70): published built-in videos and official
 * practices, with how long each runs and how many people practice it.
 * It's the same for everyone, so it's read with the public key and
 * cached (D133): at most one set of database reads every 5 minutes,
 * however many people open the home page; publishing or reordering
 * refreshes it at once.
 */
export const getLibraryItems = unstable_cache(
  () => readLibraryItems(getPublicSupabase()),
  ["library-items:v1"],
  { revalidate: LIBRARY_CACHE_SECONDS, tags: [LIBRARY_TAG] },
);

/** The official practices as everyone sees them, cached with the library. */
export const getOfficialPractices = unstable_cache(
  () => listOfficialPracticesForEveryone(getPublicSupabase()),
  ["official-practices:v1"],
  { revalidate: LIBRARY_CACHE_SECONDS, tags: [LIBRARY_TAG] },
);

async function readLibraryItems(supabase: Client): Promise<LibraryItem[]> {
  const [official, learners] = await Promise.all([
    listOfficialPracticesForEveryone(supabase),
    learnerCounts(supabase),
  ]);
  // The length the search filters on (duration_sec, D104); measured from
  // the audio only for any not stored yet.
  const unknown = official.filter((p) => p.durationSec == null);
  const seconds = await practiceSeconds(
    unknown.map((p) => p.id),
    supabase,
  );
  return [
    ...official.map((practice) =>
      practiceLibraryItem(practice, {
        seconds: practice.durationSec ?? seconds.get(practice.id),
        learners: learners.get(practice.id),
      }),
    ),
    ...getAllVideos().map((video) =>
      videoLibraryItem(video, learners.get(video.id)),
    ),
  ];
}

/**
 * The signed-in learner's saved default filter (D98), as its query
 * string; undefined when signed out (the browser keeps theirs), null
 * when they haven't saved one.
 */
export async function getSavedLibraryDefault(): Promise<
  string | null | undefined
> {
  const user = await getSignedInUser();
  const supabase = user ? await getServerSupabase() : null;
  if (!user || !supabase) return undefined;
  const { data } = await supabase
    .from("user_documents")
    .select("data")
    .eq("user_id", user.id)
    .eq("key", LIBRARY_DEFAULT_DOCUMENT)
    .maybeSingle();
  const filter = (data?.data as { filter?: unknown } | null)?.filter;
  return parseSavedFilter(filter) ? (filter as string) : null;
}

/**
 * /explore as a signed-out visitor sees it (D133): the shared practices
 * and their lengths, cached like the library.
 */
export const getSharedForEveryone = unstable_cache(
  async () => {
    const supabase = getPublicSupabase();
    const practices = await listPublicPracticesForEveryone(supabase);
    const seconds = await practiceSeconds(
      practices.map((p) => p.id),
      supabase,
    );
    return { practices, seconds: Object.fromEntries(seconds) };
  },
  ["shared-practices:v1"],
  { revalidate: LIBRARY_CACHE_SECONDS, tags: [LIBRARY_TAG] },
);
