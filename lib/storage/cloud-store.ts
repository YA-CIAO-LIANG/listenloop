import { parseActivity, type Activity } from "../activity";
import { parseProgress, type Progress } from "../progress";
import type { Supabase } from "../supabase/browser";
import type { Json } from "../supabase/database.types";

/** user_documents key for the activity log (ll-activity:v1). */
export const ACTIVITY_DOCUMENT = "activity";

/**
 * The signed-in user's practice data in Supabase (tables in
 * supabase/migrations; row level security limits every query to the
 * user's own rows). Rows that don't validate are ignored, like corrupted
 * localStorage. Every method rejects when the request fails.
 */
export type CloudData = {
  listProgress(): Promise<Progress[]>;
  saveProgress(progress: readonly Progress[]): Promise<void>;
  removeProgress(videoId: string): Promise<void>;
  /** null when the account has no activity log yet. */
  getActivity(): Promise<Activity | null>;
  saveActivity(activity: Activity): Promise<void>;
};

const asJson = (value: unknown) => value as Json;

export function createCloudData(supabase: Supabase, userId: string): CloudData {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(`Cloud sync failed: ${error.message}`);
  };

  return {
    async listProgress() {
      const { data, error } = await supabase
        .from("progress")
        .select("video_id, data")
        .eq("user_id", userId);
      fail(error);
      return (data ?? [])
        .map((row) => {
          const progress = parseProgress(row.data);
          return progress?.videoId === row.video_id ? progress : null;
        })
        .filter((progress): progress is Progress => progress !== null);
    },

    async saveProgress(progress) {
      if (progress.length === 0) return;
      const { error } = await supabase.from("progress").upsert(
        progress.map((p) => ({
          user_id: userId,
          video_id: p.videoId,
          data: asJson(p),
        })),
      );
      fail(error);
    },

    async removeProgress(videoId) {
      const { error } = await supabase
        .from("progress")
        .delete()
        .eq("user_id", userId)
        .eq("video_id", videoId);
      fail(error);
    },

    async getActivity() {
      const { data, error } = await supabase
        .from("user_documents")
        .select("data")
        .eq("user_id", userId)
        .eq("key", ACTIVITY_DOCUMENT)
        .maybeSingle();
      fail(error);
      return data ? parseActivity(data.data) : null;
    },

    async saveActivity(activity) {
      const { error } = await supabase.from("user_documents").upsert({
        user_id: userId,
        key: ACTIVITY_DOCUMENT,
        data: asJson(activity),
      });
      fail(error);
    },
  };
}
