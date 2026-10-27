/**
 * NEXT_PUBLIC_DEV_TEST_MODE=true skips the "different calendar day" unlock
 * rule so the 7-day cycle can be tested in one sitting. Never on in
 * production. Read at call time so tests can stub the variable.
 */
export function isDevTestMode(): boolean {
  return process.env.NEXT_PUBLIC_DEV_TEST_MODE === "true";
}
