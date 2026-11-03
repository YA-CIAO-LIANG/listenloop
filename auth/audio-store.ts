import { audioFileName, type AudioStore } from "@/lib/custom-practice/audio";
import type { Supabase } from "@/lib/supabase/browser";
import { SPEECH_BUCKET } from "@/lib/supabase/config";

/**
 * The audio cache in Supabase: files in the public `speech` bucket, and
 * the speech_audio table saying which exist. Both are written with the
 * secret key only (users can't upload or edit the cache).
 */
export function supabaseAudioStore(admin: Supabase): AudioStore {
  return {
    async find(hash) {
      const { data, error } = await admin
        .from("speech_audio")
        .select("path")
        .eq("hash", hash)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.path ?? null;
    },
    async save(hash, audio) {
      const path = audioFileName(hash, audio.mimeType);
      const upload = await admin.storage
        .from(SPEECH_BUCKET)
        .upload(path, audio.data, {
          contentType: audio.mimeType,
          // Same name, same content: a second upload replaces it harmlessly.
          upsert: true,
          cacheControl: "31536000",
        });
      if (upload.error) throw new Error(upload.error.message);
      const { error } = await admin.from("speech_audio").upsert(
        {
          hash,
          path,
          mime_type: audio.mimeType,
          bytes: audio.data.byteLength,
        },
        { onConflict: "hash", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
      return path;
    },
  };
}
