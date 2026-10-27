import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fishCatalog, getFish } from "@/data/fish";
import { parseFish, validateFish } from "@/lib/fish";
import {
  STARTER_FISH,
  TANK_CAPACITY,
  buyFish,
  emptyWallet,
  ensureStarterFish,
  fishOf,
  parseWallet,
  pointBalance,
  setInTank,
  type Wallet,
} from "@/lib/wallet";
import en from "@/messages/en.json";
import zh from "@/messages/zh-Hant.json";

const TODAY = "2026-10-27";
const by4 = "https://creativecommons.org/licenses/by/4.0/";

const validFish = {
  id: "clownfish",
  price: 40,
  credits: [
    {
      title: "Clownfish",
      author: "kenchoo",
      url: "https://sketchfab.com/3d-models/x",
      license: "CC BY 4.0",
      licenseUrl: by4,
    },
  ],
  changes: "Compressed for the web",
  verifiedAt: TODAY,
};

describe("validateFish", () => {
  it("accepts a well-formed fish", () => {
    expect(validateFish(validFish)).toEqual([]);
    expect(parseFish(validFish).id).toBe("clownfish");
  });

  it.each(["CC0 1.0", "CC BY 3.0", "CC BY 4.0"])("allows %s", (license) => {
    const credits = [{ ...validFish.credits[0], license }];
    expect(validateFish({ ...validFish, credits })).toEqual([]);
  });

  it.each(["CC BY-NC 4.0", "CC BY-ND 4.0", "CC BY-SA 4.0", "Standard"])(
    "rejects %s (no commercial use, no changes, or share-alike)",
    (license) => {
      const credits = [{ ...validFish.credits[0], license }];
      expect(validateFish({ ...validFish, credits })).toContain(
        "credits[0].license must be CC0 1.0 or CC BY x.x",
      );
    },
  );

  it.each([
    ["no credits", { credits: [] }, "credits must be a non-empty list"],
    ["a free fish", { price: 0 }, "price must be a positive whole number"],
    [
      "an http link",
      { credits: [{ ...validFish.credits[0], url: "http://x.y" }] },
      "credits[0].url must be an https URL",
    ],
    [
      "a PNG thumbnail",
      { thumbnail: "/fish/a.png" },
      "thumbnail must be a /path/to/file.webp",
    ],
  ])("rejects %s", (_, changes, problem) => {
    expect(validateFish({ ...validFish, ...changes })).toContain(problem);
  });
});

// Quality gate for real content: every file in data/fish must be valid.
const fishDir = join(process.cwd(), "data/fish");
const fishFiles = readdirSync(fishDir).filter((f) => f.endsWith(".json"));

describe("data/fish", () => {
  it.each(fishFiles)("%s is valid and named after its id", (file) => {
    const data = JSON.parse(readFileSync(join(fishDir, file), "utf8"));
    expect(validateFish(data)).toEqual([]);
    expect(`${data.id}.json`).toBe(file);
  });

  it("lists every fish file in data/fish/index.ts, once", () => {
    const listed = fishCatalog.map((fish) => `${fish.id}.json`);
    expect([...listed].sort()).toEqual([...fishFiles].sort());
  });

  it("has a name and blurb for every fish in both languages", () => {
    for (const messages of [zh, en]) {
      for (const fish of fishCatalog) {
        const text = (
          messages.fish as Record<string, { name?: string; blurb?: string }>
        )[fish.id];
        expect(text?.name, fish.id).toBeTruthy();
        expect(text?.blurb, fish.id).toBeTruthy();
      }
    }
  });

  it("sells the starter fish", () => {
    expect(getFish(STARTER_FISH)).toBeDefined();
  });
});

describe("owned fish", () => {
  const rich = (points: number): Wallet => ({
    ...emptyWallet(),
    points: {
      earned: [{ id: "gift", amount: points, date: TODAY }],
      spent: [],
    },
  });

  it("gives the starter snail once, swimming", () => {
    const wallet = ensureStarterFish(emptyWallet(), TODAY);
    expect(fishOf(wallet)).toEqual({
      owned: [{ id: "snail:starter", species: "snail", date: TODAY }],
      inTank: ["snail:starter"],
    });
    expect(ensureStarterFish(wallet, TODAY)).toBe(wallet);
  });

  it("buys a fish with points and puts it in the aquarium", () => {
    const wallet = buyFish(rich(100), "clownfish", 40, TODAY)!;
    expect(pointBalance(wallet)).toBe(60);
    expect(wallet.points.spent).toEqual([
      { id: "buy:clownfish:1", amount: 40, date: TODAY },
    ]);
    const again = buyFish(wallet, "clownfish", 40, TODAY)!;
    expect(fishOf(again).owned.map((f) => f.id)).toEqual([
      "clownfish:1",
      "clownfish:2",
    ]);
    expect(fishOf(again).inTank).toEqual(["clownfish:1", "clownfish:2"]);
  });

  it("won't buy without enough points", () => {
    expect(buyFish(rich(39), "clownfish", 40, TODAY)).toBeNull();
  });

  it("keeps new fish out of a full aquarium, and swaps on request", () => {
    let wallet = rich(1000);
    for (let i = 0; i < TANK_CAPACITY + 1; i++) {
      wallet = buyFish(wallet, "snail", 30, TODAY)!;
    }
    const { inTank } = fishOf(wallet);
    expect(inTank).toHaveLength(TANK_CAPACITY);
    expect(inTank).not.toContain("snail:13");

    expect(setInTank(wallet, "snail:13", true)).toBe(wallet); // still full
    const swapped = setInTank(
      setInTank(wallet, "snail:1", false),
      "snail:13",
      true,
    );
    expect(fishOf(swapped).inTank).toContain("snail:13");
    expect(fishOf(swapped).inTank).not.toContain("snail:1");
  });

  it("ignores unknown fish and no-op changes", () => {
    const wallet = ensureStarterFish(emptyWallet(), TODAY);
    expect(setInTank(wallet, "shark:9", true)).toBe(wallet);
    expect(setInTank(wallet, "snail:starter", true)).toBe(wallet);
  });

  it("reads wallets saved before the shop, and rejects broken fish data", () => {
    expect(parseWallet(emptyWallet())).toEqual(emptyWallet());
    expect(
      parseWallet({ ...emptyWallet(), fish: { owned: [{}], inTank: [] } }),
    ).toBeNull();
  });
});
