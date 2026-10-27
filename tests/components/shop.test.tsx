import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShopView } from "@/components/ShopView";
import { fishCatalog } from "@/data/fish";
import type { RewardStore } from "@/lib/storage/reward-store";
import { REWARDS_EVENT } from "@/components/useRewards";
import {
  TANK_CAPACITY,
  emptyWallet,
  ensureStarterFish,
  fishOf,
  type Wallet,
} from "@/lib/wallet";
import { renderWithIntl } from "../render";

const TODAY = "2026-10-27";

function storeWith(initial: Wallet) {
  let saved = initial;
  const store: RewardStore & { saved: () => Wallet } = {
    getWallet: vi.fn(async () => saved),
    saveWallet: vi.fn(async (wallet: Wallet) => {
      saved = wallet;
    }),
    getActivity: vi.fn(async () => ({ days: {} })),
    saveActivity: vi.fn(async () => {}),
    saved: () => saved,
  };
  return store;
}

const withPoints = (points: number): Wallet => ({
  ...emptyWallet(),
  points: { earned: [{ id: "gift", amount: points, date: TODAY }], spent: [] },
});

async function renderShop(store: RewardStore) {
  renderWithIntl(<ShopView catalog={fishCatalog} rewards={store} />);
  await act(async () => {});
}

const card = (name: string) =>
  screen.getByRole("heading", { name }).closest("li")!;

describe("ShopView", () => {
  it("lists every fish with its price", async () => {
    await renderShop(storeWith(withPoints(0)));
    expect(screen.getByText("你有 0 點數")).toBeDefined();
    const clownfish = within(card("小丑魚"));
    expect(clownfish.getByText("40 點數")).toBeDefined();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(
      fishCatalog.length,
    );
  });

  it("gives the starter snail on the first visit", async () => {
    const store = storeWith(emptyWallet());
    await renderShop(store);
    expect(fishOf(store.saved()).owned).toHaveLength(1);
    expect(screen.getByText("水蝸牛 · 見面禮")).toBeDefined();
    expect(screen.getByText("魚缸 1 / 12")).toBeDefined();
  });

  it("asks once more, then buys and tells the header", async () => {
    const store = storeWith(ensureStarterFish(withPoints(50), TODAY));
    const onRewards = vi.fn();
    window.addEventListener(REWARDS_EVENT, onRewards);
    await renderShop(store);

    const clownfish = within(card("小丑魚"));
    fireEvent.click(clownfish.getByRole("button", { name: "購買" }));
    expect(clownfish.getByText("用 40 點數購買小丑魚？")).toBeDefined();
    await act(async () =>
      fireEvent.click(clownfish.getByRole("button", { name: "確定購買" })),
    );

    expect(screen.getByText("已購買小丑魚，牠游進魚缸了。")).toBeDefined();
    expect(screen.getByText("你有 10 點數")).toBeDefined();
    expect(screen.getByText("小丑魚 #1")).toBeDefined();
    expect(fishOf(store.saved()).inTank).toContain("clownfish:1");
    expect(onRewards.mock.lastCall?.[0].detail.balance.points).toBe(10);
    window.removeEventListener(REWARDS_EVENT, onRewards);
  });

  it("cancels without spending", async () => {
    const store = storeWith(ensureStarterFish(withPoints(50), TODAY));
    await renderShop(store);
    const snail = within(card("水蝸牛"));
    fireEvent.click(snail.getByRole("button", { name: "購買" }));
    fireEvent.click(snail.getByRole("button", { name: "取消" }));
    expect(store.saveWallet).toHaveBeenCalledTimes(0);
    expect(snail.getByRole("button", { name: "購買" })).toBeDefined();
  });

  it("can't buy what the points don't cover", async () => {
    await renderShop(storeWith(ensureStarterFish(withPoints(50), TODAY)));
    const shark = within(card("大白鯊"));
    expect(
      shark.getByRole("button", { name: "購買" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(shark.getByText("還差 150 點數")).toBeDefined();
  });

  it("chooses which fish swim, up to the aquarium's size", async () => {
    let wallet = ensureStarterFish(withPoints(1000), TODAY);
    const owned = Array.from({ length: TANK_CAPACITY }, (_, i) => ({
      id: `snail:${i + 1}`,
      species: "snail",
      date: TODAY,
    }));
    wallet = {
      ...wallet,
      fish: {
        owned: [...fishOf(wallet).owned, ...owned],
        inTank: owned.map((f) => f.id),
      },
    };
    const store = storeWith(wallet);
    await renderShop(store);

    expect(screen.getByText("魚缸 12 / 12")).toBeDefined();
    const starter = screen.getByRole("checkbox", { name: "魚缸已滿" });
    expect(starter.hasAttribute("disabled")).toBe(true);

    const first = screen.getAllByRole("checkbox", { name: "放進魚缸" })[0];
    await act(async () => fireEvent.click(first));
    expect(fishOf(store.saved()).inTank).toHaveLength(11);
    expect(screen.getByText("魚缸 11 / 12")).toBeDefined();
  });
});
