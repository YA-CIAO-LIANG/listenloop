import { cookies } from "next/headers";
import { getOfficialPractices } from "@/auth/library";
import { getServerSupabase } from "@/auth/server";
import { getSignedInUser } from "@/auth/session";
import { ONBOARDING_COOKIE } from "@/lib/notices";
import { getVideosByCollection } from "@/lib/video-library";
import { Onboarding } from "./Onboarding";

/**
 * Whether to show the first-visit guide, and where it starts (D61, D62):
 * not once skipped (cookie), nor for a signed-in learner who has a
 * practice, nor signed out, where the home page's intro explains the
 * loop instead (D70). It starts at the first official practice in the admins'
 * order, else the first beginner video in the library. Decided on the
 * server, so the guide never pops in after the page has drawn.
 */
export async function OnboardingStart() {
  const [cookieStore, user] = await Promise.all([cookies(), getSignedInUser()]);
  if (cookieStore.has(ONBOARDING_COOKIE) || !user) return null;
  const supabase = await getServerSupabase();
  const { count } = supabase
    ? await supabase
        .from("progress")
        .select("video_id", { count: "exact", head: true })
        .eq("user_id", user.id)
    : { count: 0 };
  if ((count ?? 0) > 0) return null;
  const official = await getOfficialPractices().catch(() => []);
  const videos = getVideosByCollection().flatMap(({ videos }) => videos);
  const start =
    official[0]?.id ??
    (videos.find((v) => v.level === "beginner") ?? videos[0])?.id;
  return <Onboarding startHref={start ? `/videos/${start}` : "/#library"} />;
}
