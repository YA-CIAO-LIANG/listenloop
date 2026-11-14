import { cookies } from "next/headers";
import { cache } from "react";
import {
  activityDevices,
  cleanReferralCode,
  day1Cutoff,
  finishedDay1Since,
  newReferralCode,
  REFERRAL_COOKIE,
  REFERRAL_VALID_DAYS,
  referralVerdict,
  sharesDevice,
  summarizeReferrals,
  type ReferralGrant,
  type ReferralSummary,
} from "@/lib/referral";
import { ACTIVITY_DOCUMENT } from "@/lib/storage/cloud-store";
import { getAdminSupabase } from "./admin";

/**
 * The referral program on the server (D177): codes, recording a friend
 * who signed up through a link, and settling a referral once the friend
 * finished Day 1. Everything uses the secret key: the tables are read
 * only by their owners and written only here. Without the key nothing
 * happens (local development without Supabase).
 */
type Admin = NonNullable<ReturnType<typeof getAdminSupabase>>;

/** This account's code, made the first time it's asked for. */
export async function referralCodeFor(userId: string): Promise<string | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.code) return data.code;
  // A clash with another account's code (one in a trillion) tries again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newReferralCode();
    const { error } = await admin
      .from("referral_codes")
      .insert({ user_id: userId, code });
    if (!error) return code;
    // Made at the same moment by another request: read it back.
    const { data: again } = await admin
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .maybeSingle();
    if (again?.code) return again.code;
  }
  return null;
}

/** The referral code this browser brought (from /r/<code>), if any. */
export async function referralFromCookie(): Promise<string | null> {
  return cleanReferralCode((await cookies()).get(REFERRAL_COOKIE)?.value);
}

/** Whose code this is, if anyone's. */
export async function referrerOf(code: string): Promise<string | null> {
  const admin = getAdminSupabase();
  const clean = cleanReferralCode(code);
  if (!admin || !clean) return null;
  const { data } = await admin
    .from("referral_codes")
    .select("user_id")
    .eq("code", clean)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * Right after a new account is let in (auth/beta.ts): the referral code
 * this browser brought, if any, becomes a pending referral. Never one's
 * own code; a friend is referred once. Best effort: a sign-in never
 * fails over this. The sign-up cap applies as usual (no extra seats).
 */
export async function recordReferral(
  admin: Admin,
  refereeId: string,
): Promise<void> {
  try {
    const jar = await cookies();
    const code = cleanReferralCode(jar.get(REFERRAL_COOKIE)?.value);
    if (!code) return;
    jar.delete(REFERRAL_COOKIE);
    const referrerId = await referrerOf(code);
    if (!referrerId || referrerId === refereeId) return;
    await admin
      .from("referrals")
      .upsert(
        { referrer_id: referrerId, referee_id: refereeId },
        { onConflict: "referee_id", ignoreDuplicates: true },
      );
  } catch {
    // Not worth failing a sign-in over.
  }
}

type ReferralRow = {
  id: string;
  referrer_id: string;
  referee_id: string | null;
  created_at: string;
};

/**
 * Settles one pending referral (lib/referral.ts referralVerdict): the
 * facts come from the database only (cloud progress, sign-up IP hashes,
 * practice devices), never from what a browser claims.
 */
async function settle(
  admin: Admin,
  referral: ReferralRow,
  now: Date,
): Promise<void> {
  if (!referral.referee_id) return;
  const people = [referral.referrer_id, referral.referee_id];
  const dayBefore = new Date(
    Date.parse(referral.created_at) - 86_400_000,
  ).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [progress, signals, documents, recent, rewards] = await Promise.all([
    admin.from("progress").select("data").eq("user_id", referral.referee_id),
    admin
      .from("account_signals")
      .select("user_id, ip_hash")
      .in("user_id", people),
    admin
      .from("user_documents")
      .select("user_id, data")
      .eq("key", ACTIVITY_DOCUMENT)
      .in("user_id", people),
    admin
      .from("referrals")
      .select("id, created_at")
      .eq("referrer_id", referral.referrer_id)
      .gte("created_at", dayBefore)
      .lte("created_at", referral.created_at),
    admin
      .from("referral_rewards")
      .select("id")
      .eq("user_id", referral.referrer_id)
      .eq("role", "referrer")
      .gte("created_at", monthAgo),
  ]);
  if (progress.error || signals.error || documents.error || recent.error) {
    return;
  }
  const ip = (id: string) =>
    signals.data?.find((s) => s.user_id === id)?.ip_hash ?? null;
  const devices = (id: string) =>
    activityDevices(documents.data?.find((d) => d.user_id === id)?.data);
  const referrerIp = ip(referral.referrer_id);
  const verdict = referralVerdict({
    referrerId: referral.referrer_id,
    refereeId: referral.referee_id,
    createdAt: referral.created_at,
    sameIp: referrerIp !== null && referrerIp === ip(referral.referee_id),
    sameDevice: sharesDevice(
      devices(referral.referrer_id),
      devices(referral.referee_id),
    ),
    burst: Math.max(1, recent.data?.length ?? 1),
    day1: finishedDay1Since(
      (progress.data ?? []).map((row) => row.data),
      day1Cutoff(referral.created_at),
    ),
    referrerRecentRewards: rewards.data?.length ?? 0,
    now,
  });
  if (verdict.status === "pending") return;
  if (verdict.status === "qualified") {
    await admin.rpc("qualify_referral", {
      target: referral.id,
      referrer_minutes: verdict.referrerMinutes,
      referee_minutes: verdict.refereeMinutes,
      valid_days: REFERRAL_VALID_DAYS,
    });
    return;
  }
  await admin
    .from("referrals")
    .update({
      status: verdict.status,
      reason: verdict.status === "rejected" ? verdict.reason : null,
      settled_at: now.toISOString(),
    })
    .eq("id", referral.id)
    .eq("status", "pending");
}

/**
 * Settles the pending referrals this account is in, as the friend or as
 * the referrer: after the friend's Day 1 (app/events/actions.ts), and
 * whenever either opens "My quota", so a reward never depends on one
 * request arriving after the progress upload.
 */
export async function settleReferralsFor(userId: string): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return;
  try {
    const { data } = await admin
      .from("referrals")
      .select("id, referrer_id, referee_id, created_at")
      .eq("status", "pending")
      .or(`referee_id.eq.${userId},referrer_id.eq.${userId}`)
      .order("created_at")
      .limit(50);
    const now = new Date();
    for (const referral of data ?? []) await settle(admin, referral, now);
  } catch {
    // Settled next time.
  }
}

/** This account's bonus grants (lib/referral.ts bonusPool), once a request. */
export const getReferralGrants = cache(
  async (userId: string): Promise<ReferralGrant[]> => {
    const admin = getAdminSupabase();
    if (!admin) return [];
    const { data } = await admin
      .from("referral_rewards")
      .select("minutes, created_at, expires_at")
      .eq("user_id", userId);
    return (data ?? []).flatMap((row) =>
      typeof row.minutes === "number" &&
      typeof row.created_at === "string" &&
      typeof row.expires_at === "string"
        ? [
            {
              minutes: row.minutes,
              grantedAt: row.created_at,
              expiresAt: row.expires_at,
            },
          ]
        : [],
    );
  },
);

/** What "My quota" shows about the program; null without the database. */
export async function referralSummary(
  userId: string,
): Promise<Omit<ReferralSummary, "leftMinutes"> | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const [code, referrals, rewards] = await Promise.all([
    referralCodeFor(userId),
    admin.from("referrals").select("status").eq("referrer_id", userId),
    admin.from("referral_rewards").select("minutes").eq("user_id", userId),
  ]);
  return {
    code,
    ...summarizeReferrals(referrals.data ?? [], rewards.data ?? []),
  };
}
