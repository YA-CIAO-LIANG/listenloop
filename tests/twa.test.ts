import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/.well-known/assetlinks.json/route";
import manifest from "@/app/manifest";
import {
  assetLinksFromEnv,
  isTwaReferrer,
  normalizeFingerprint,
} from "@/lib/twa";

/** The Android app's Digital Asset Links and TWA detection (D178). */
const UPLOAD =
  "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const PLAY =
  "A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeFingerprint", () => {
  it("keeps keytool's form and upper-cases", () => {
    expect(normalizeFingerprint(UPLOAD.toLowerCase())).toBe(UPLOAD);
  });
  it("adds colons to bare hex and drops a SHA256: label", () => {
    expect(normalizeFingerprint(UPLOAD.replaceAll(":", ""))).toBe(UPLOAD);
    expect(normalizeFingerprint(`SHA256: ${UPLOAD}`)).toBe(UPLOAD);
  });
  it("rejects anything that isn't 32 bytes", () => {
    expect(normalizeFingerprint("AB:CD")).toBeNull();
    expect(normalizeFingerprint(`${UPLOAD}:00`)).toBeNull();
    expect(normalizeFingerprint("not a fingerprint")).toBeNull();
  });
});

describe("assetLinksFromEnv", () => {
  it("is empty when nothing is set", () => {
    expect(assetLinksFromEnv({})).toEqual([]);
  });
  it("is empty without a valid package name or fingerprint", () => {
    expect(assetLinksFromEnv({ TWA_SHA256_FINGERPRINTS: UPLOAD })).toEqual([]);
    expect(
      assetLinksFromEnv({
        TWA_PACKAGE_NAME: "listenloop",
        TWA_SHA256_FINGERPRINTS: UPLOAD,
      }),
    ).toEqual([]);
    expect(
      assetLinksFromEnv({
        TWA_PACKAGE_NAME: "app.listenloop.twa",
        TWA_SHA256_FINGERPRINTS: "nope",
      }),
    ).toEqual([]);
  });
  it("lists both keys once, skipping invalid ones", () => {
    expect(
      assetLinksFromEnv({
        TWA_PACKAGE_NAME: " app.listenloop.twa ",
        TWA_SHA256_FINGERPRINTS: `${UPLOAD}, ${PLAY.toLowerCase()},bad,${UPLOAD}`,
      }),
    ).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "app.listenloop.twa",
          sha256_cert_fingerprints: [UPLOAD, PLAY],
        },
      },
    ]);
  });
});

describe("/.well-known/assetlinks.json", () => {
  it("answers [] as JSON when unset", async () => {
    vi.stubEnv("TWA_PACKAGE_NAME", "");
    vi.stubEnv("TWA_SHA256_FINGERPRINTS", "");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual([]);
  });
  it("answers the statement from the environment", async () => {
    vi.stubEnv("TWA_PACKAGE_NAME", "app.listenloop.twa");
    vi.stubEnv("TWA_SHA256_FINGERPRINTS", `${UPLOAD},${PLAY}`);
    const [statement] = await GET().json();
    expect(statement.target.package_name).toBe("app.listenloop.twa");
    expect(statement.target.sha256_cert_fingerprints).toEqual([UPLOAD, PLAY]);
  });
});

describe("android/twa-manifest.json", () => {
  const twa = JSON.parse(
    readFileSync(join(process.cwd(), "android/twa-manifest.json"), "utf8"),
  );
  const web = manifest();

  it("matches the web manifest and the template's package", () => {
    const template = JSON.parse(
      readFileSync(
        join(process.cwd(), "android/assetlinks.template.json"),
        "utf8",
      ),
    );
    expect(template[0].target.package_name).toBe(twa.packageId);
    expect(
      assetLinksFromEnv({
        TWA_PACKAGE_NAME: twa.packageId,
        TWA_SHA256_FINGERPRINTS: UPLOAD,
      }),
    ).toHaveLength(1);
    expect(twa.themeColor.toLowerCase()).toBe(web.theme_color);
    expect(twa.backgroundColor.toLowerCase()).toBe(web.background_color);
    expect(twa.startUrl).toBe(web.start_url);
    expect(twa.fallbackType).toBe("customtabs");
  });

  it("uses icons that exist, maskable and monochrome included", () => {
    for (const key of ["iconUrl", "maskableIconUrl", "monochromeIconUrl"]) {
      const url = new URL(twa[key]);
      expect(url.host).toBe(twa.host);
      expect(existsSync(join(process.cwd(), "public", url.pathname))).toBe(
        true,
      );
    }
    const purposes = (web.icons ?? []).map((icon) => icon.purpose);
    expect(purposes).toEqual(
      expect.arrayContaining(["maskable", "monochrome"]),
    );
  });

  it("keeps the signing key outside the repo", () => {
    const keyPath = resolve(process.cwd(), "android", twa.signingKey.path);
    expect(keyPath.startsWith(process.cwd() + sep)).toBe(false);
  });
});

describe("isTwaReferrer", () => {
  it("knows the Android app's referrer", () => {
    expect(isTwaReferrer("android-app://app.listenloop.twa/")).toBe(true);
    expect(isTwaReferrer("https://www.google.com/")).toBe(false);
    expect(isTwaReferrer("")).toBe(false);
  });
});
