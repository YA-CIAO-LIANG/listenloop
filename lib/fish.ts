/** Shape of data/fish/<id>.json (see docs/aquarium.md). */

/**
 * A fish in the shop. Every fish is pixel art drawn by code (lib/pixel-fish),
 * so there are no third-party assets to credit.
 */
export type Fish = {
  /** Lowercase with dashes; names and blurbs live in messages → fish.<id>. */
  id: string;
  /** In points. */
  price: number;
};

type Data = Record<string, unknown>;
const isObject = (value: unknown): value is Data =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
