import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AquariumBackground } from "@/components/aquarium/AquariumBackground";
import { FeedCalendar } from "@/components/aquarium/FeedCalendar";
import { FeedCard } from "@/components/aquarium/FeedCard";
import { TAP_SLOP, isTap, isWaterTarget } from "@/components/aquarium/tap";
import { FED_EVENT } from "@/components/aquarium/useAquariumWallet";
import { toLocalDate } from "@/lib/dates";
import type { RewardStore } from "@/lib/storage/reward-store";
import {
  emptyWallet,
  ensureStarterFish,
  feedBalance,
  type Wallet,
} from "@/lib/wallet";
import { renderWithIntl } from "../render";

const today = toLocalDate(new Date());

function daysAgo(n: number) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toLocalDate(date);
}

/** Starter snail (arrived `arrived`), `portions` of feed, fed on `fed` days. */
function walletWith(
  portions: number,
  arrived = today,
  fed: string[] = [],
): Wallet {
  const wallet = ensureStarterFish(emptyWallet(), arrived);
  return {
    ...wallet,
    feed: {
      earned: Array.from({ length: portions + fed.length }, (_, i) => ({
        id: `feed:${i}`,
        amount: 1,
        date: arrived,
      })),
      used: fed.map((date, i) => ({
        id: `fed:${date}:${i + 1}`,
        amount: 1,
        date,
      })),
    },
  };
}

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

const drawImage = vi.fn();
function fakeCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        drawImage,
        putImageData: vi.fn(),
        setTransform: vi.fn(),
        imageSmoothingEnabled: true,
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    "ImageData",
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
}

function reducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduce") ? reduce : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  drawImage.mockClear();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("tap detection", () => {
  it("counts a press as a tap only if it moved less than about 10px", () => {
    expect(TAP_SLOP).toBe(10);
    expect(isTap({ x: 100, y: 100 }, { x: 106, y: 104 })).toBe(true);
    expect(isTap({ x: 100, y: 100 }, { x: 100, y: 112 })).toBe(false); // a scroll
  });

  it("treats cards, the header, and controls as solid, the rest as water", () => {
    document.body.innerHTML = `
      <header><a id="logo">L</a></header>
      <main id="main">
        <div id="window"></div>
        <div data-solid id="card"><p id="text">t</p><button id="button">b</button></div>
      </main>`;
    const at = (id: string) => document.getElementById(id);
    expect(isWaterTarget(at("main"))).toBe(true);
    expect(isWaterTarget(at("window"))).toBe(true);
    expect(isWaterTarget(at("text"))).toBe(false);
    expect(isWaterTarget(at("button"))).toBe(false);
    expect(isWaterTarget(at("logo"))).toBe(false);
    expect(isWaterTarget(null)).toBe(false);
    document.body.innerHTML = "";
  });
});

describe("AquariumBackground", () => {
  async function renderTank(store: RewardStore) {
    const view = renderWithIntl(
      <div>
        <AquariumBackground rewards={store} />
        <div data-testid="water" style={{ height: 300 }} />
        <div data-solid data-testid="card">
          card
        </div>
      </div>,
    );
    await act(async () => {});
    return view;
  }

  function press(
    element: Element,
    from: [number, number],
    to: [number, number],
  ) {
    fireEvent.pointerDown(element, {
      pointerId: 1,
      clientX: from[0],
      clientY: from[1],
    });
    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: to[0],
      clientY: to[1],
    });
  }

  it("feeds where the water is tapped", async () => {
    fakeCanvas();
    reducedMotion(false);
    const store = storeWith(walletWith(2));
    const fed = vi.fn();
    window.addEventListener(FED_EVENT, fed);
    await renderTank(store);
    expect(window.requestAnimationFrame).toHaveBeenCalled();

    await act(async () =>
      press(screen.getByTestId("water"), [120, 80], [123, 82]),
    );
    expect(feedBalance(store.saved())).toBe(1);
    expect(fed.mock.lastCall?.[0].detail.point).toEqual({ x: 123, y: 82 });
    window.removeEventListener(FED_EVENT, fed);
  });

  it("doesn't feed when the page is scrolled or dragged, or a card is tapped", async () => {
    fakeCanvas();
    reducedMotion(false);
    const store = storeWith(walletWith(2));
    await renderTank(store);

    await act(async () =>
      press(screen.getByTestId("water"), [120, 80], [120, 140]),
    );
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId("water"), {
        pointerId: 2,
        clientX: 50,
        clientY: 50,
      });
      fireEvent.pointerCancel(screen.getByTestId("water"), { pointerId: 2 });
      fireEvent.pointerUp(screen.getByTestId("water"), {
        pointerId: 2,
        clientX: 50,
        clientY: 50,
      });
    });
    await act(async () =>
      press(screen.getByTestId("card"), [10, 10], [10, 10]),
    );
    expect(feedBalance(store.saved())).toBe(2);
  });

  it("does nothing on a tap without feed", async () => {
    fakeCanvas();
    reducedMotion(false);
    const store = storeWith(walletWith(0));
    await renderTank(store);
    await act(async () => press(screen.getByTestId("water"), [5, 5], [5, 5]));
    expect(store.saveWallet).toHaveBeenCalledTimes(0);
  });

  it("stays still with reduced motion, and feeding redraws without a loop", async () => {
    fakeCanvas();
    reducedMotion(true);
    const store = storeWith(walletWith(2));
    await renderTank(store);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    const before = drawImage.mock.calls.length;
    await act(async () =>
      press(screen.getByTestId("water"), [30, 30], [30, 30]),
    );
    expect(feedBalance(store.saved())).toBe(1);
    expect(drawImage.mock.calls.length).toBeGreaterThan(before);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("falls back to a plain water gradient without canvas, and still feeds", async () => {
    reducedMotion(false);
    const store = storeWith(walletWith(1));
    const { container } = await renderTank(store);
    expect(
      container.querySelector("[data-aquarium='fallback']"),
    ).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
    await act(async () =>
      press(screen.getByTestId("water"), [30, 30], [30, 30]),
    );
    expect(feedBalance(store.saved())).toBe(0);
  });
});

describe("FeedCard", () => {
  async function renderCard(wallet: Wallet) {
    const store = storeWith(wallet);
    renderWithIntl(<FeedCard rewards={store} />);
    await act(async () => {});
    return store;
  }

  it("shows the feed left and feeds with the button", async () => {
    const store = await renderCard(walletWith(2));
    expect(screen.getByText("飼料 2 份")).toBeDefined();
    expect(screen.getByText("點魚缸的水面也可以餵。")).toBeDefined();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "餵魚" })),
    );
    expect(feedBalance(store.saved())).toBe(1);
    expect(screen.getByText("已餵食，剩 1 份飼料。")).toBeDefined();
    expect(screen.getByText("今天餵過了")).toBeDefined();
  });

  it("says the fish are a little hungry after two days", async () => {
    await renderCard(walletWith(1, daysAgo(3), [daysAgo(2)]));
    expect(screen.getByText("魚有點餓了，餵一份飼料吧。")).toBeDefined();
  });

  it("explains how to get feed when there's none", async () => {
    await renderCard(walletWith(0));
    expect(screen.getByText("完成今天的任務就能得到飼料。")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "餵魚" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("links to the shop and My fish", async () => {
    await renderCard(walletWith(1));
    expect(
      screen.getByRole("link", { name: /魚店與我的魚/ }).getAttribute("href"),
    ).toBe("/shop");
  });
});

describe("FeedCalendar", () => {
  it("marks the days the fish were fed and today, Sunday first", async () => {
    const store = storeWith(walletWith(1, daysAgo(40), [today]));
    renderWithIntl(<FeedCalendar rewards={store} />);
    await act(async () => {});
    const headers = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    expect(headers[0]).toBe("日");
    expect(headers).toHaveLength(7);
    expect(screen.getByText(/，有餵魚（今天）$/)).toBeDefined();
    expect(document.querySelectorAll("[data-fed]")).toHaveLength(1);
  });

  it("moves between months", async () => {
    const store = storeWith(walletWith(1));
    renderWithIntl(<FeedCalendar rewards={store} />);
    await act(async () => {});
    const title = () => screen.getByRole("heading", { level: 2 }).textContent;
    const now = title();
    fireEvent.click(screen.getByRole("button", { name: /上個月/ }));
    expect(title()).not.toBe(now);
    fireEvent.click(screen.getByRole("button", { name: /下個月/ }));
    expect(title()).toBe(now);
  });
});
