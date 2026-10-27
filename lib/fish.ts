/** Shape of data/fish/<id>.json (see docs/aquarium.md → 素材). */

/**
 * 3D assets must allow commercial use and changes (we compress them), so
 * only CC0 and CC BY. NC, ND, and SA never pass.
 */
export const ALLOWED_FISH_LICENSE = /^(CC0 1\.0|CC BY \d\.\d)$/;

/** One credited work: the model we use, or the original it was made from. */
export type FishCredit = {
  title: string;
  author: string;
  /** The model's official page. */
  url: string;
  license: string;
  licenseUrl: string;
};

export type Fish = {
  /** Lowercase with dashes; names and blurbs live in messages → fish.<id>. */
  id: string;
  /** In points. */
  price: number;
  /** The model used first, then the works it was made from. */
  credits: FishCredit[];
  /** What ListenLoop changed (CC BY asks for it). */
  changes: string;
  /** When the licenses were last checked on the official pages. */
  verifiedAt: string;
  /** Transparent WebP, rendered from the model (added with the aquarium). */
  thumbnail?: string;
};

type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";
const isHttps = (value: unknown) =>
  typeof value === "string" && /^https:\/\/\S+$/.test(value);

/** Lists everything wrong with a fish file; an empty list means valid. */
export function validateFish(data: unknown): string[] {
  if (!isObject(data)) return ["fish must be an object"];
  const problems: string[] = [];
  if (typeof data.id !== "string" || !/^[a-z]+(-[a-z]+)*$/.test(data.id)) {
    problems.push("id must be lowercase letters and dashes");
  }
  if (!Number.isInteger(data.price) || (data.price as number) <= 0) {
    problems.push("price must be a positive whole number");
  }
  if (!isText(data.changes)) problems.push("changes must be text");
  if (
    typeof data.verifiedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.verifiedAt)
  ) {
    problems.push("verifiedAt must be a YYYY-MM-DD date");
  }
  if (
    data.thumbnail !== undefined &&
    !(
      typeof data.thumbnail === "string" && /^\/\S+\.webp$/.test(data.thumbnail)
    )
  ) {
    problems.push("thumbnail must be a /path/to/file.webp");
  }

  if (!Array.isArray(data.credits) || data.credits.length === 0) {
    problems.push("credits must be a non-empty list");
  } else {
    data.credits.forEach((credit: unknown, index) => {
      const where = `credits[${index}]`;
      if (!isObject(credit)) {
        problems.push(`${where} must be an object`);
        return;
      }
      for (const field of ["title", "author", "license"]) {
        if (!isText(credit[field]))
          problems.push(`${where}.${field} must be text`);
      }
      for (const field of ["url", "licenseUrl"]) {
        if (!isHttps(credit[field])) {
          problems.push(`${where}.${field} must be an https URL`);
        }
      }
      if (
        typeof credit.license === "string" &&
        !ALLOWED_FISH_LICENSE.test(credit.license)
      ) {
        problems.push(`${where}.license must be CC0 1.0 or CC BY x.x`);
      }
    });
  }
  return problems;
}

/** Returns the data as a Fish, or throws listing every problem. */
export function parseFish(data: unknown): Fish {
  const problems = validateFish(data);
  if (problems.length > 0) {
    throw new Error(`Invalid fish:\n- ${problems.join("\n- ")}`);
  }
  return data as Fish;
}
