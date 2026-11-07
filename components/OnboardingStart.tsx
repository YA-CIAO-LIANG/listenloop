import { listOfficialPractices } from "@/auth/public-practices";
import { getVideosByCollection } from "@/lib/video-library";
import { Onboarding } from "./Onboarding";

/**
 * Where a new learner should start (D61): the first official practice in
 * the admins' order, else the first beginner video in the library.
 */
export async function OnboardingStart() {
  const official = await listOfficialPractices().catch(() => []);
  const videos = getVideosByCollection().flatMap(({ videos }) => videos);
  const start =
    official[0]?.id ??
    (videos.find((v) => v.level === "beginner") ?? videos[0])?.id;
  return <Onboarding startHref={start ? `/videos/${start}` : "/#library"} />;
}
