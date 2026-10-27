import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AquariumDemo } from "@/app/styleguide/AquariumDemo";
import { FramesGallery } from "@/app/styleguide/FramesGallery";
import { FishThumbnail } from "@/components/FishThumbnail";
import { renderWithIntl } from "../render";

const drawImage = vi.fn();

function screenPrefersReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduce") ? reduce : false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  drawImage.mockClear();
  // jsdom has no canvas: a context that records draws is enough here.
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
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const everyone = ["whale-shark", "great-white", "clownfish", "snail"] as const;

function renderTank(label = "四隻魚") {
  renderWithIntl(
    <AquariumDemo
      species={everyone}
      width={520}
      height={260}
      scale="2"
      label={label}
    />,
  );
}

describe("AquariumDemo (styleguide)", () => {
  it("animates all four together and offers every control", () => {
    screenPrefersReducedMotion(false);
    renderTank();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "四隻魚" })).toBeDefined();
    for (const name of ["暫停", "轉身", "眨眼", "撒飼料"]) {
      expect(screen.getByRole("button", { name })).toBeDefined();
    }
    for (const name of ["一般", "吃飽", "飢餓", "1×", "4×"]) {
      expect(screen.getByRole("radio", { name })).toBeDefined();
    }
    expect(screen.getByText(/魚的眼睛會跟著看/)).toBeDefined();
  });

  it("stays still with reduced motion; buttons switch still pictures", () => {
    screenPrefersReducedMotion(true);
    renderTank();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "暫停" })).toBeNull();
    // Water + four bodies + five eyes (two on the snail) per still frame.
    expect(drawImage.mock.calls.length).toBeGreaterThanOrEqual(10);
    for (const name of ["轉身", "眨眼", "撒飼料"]) {
      const before = drawImage.mock.calls.length;
      act(() => fireEvent.click(screen.getByRole("button", { name })));
      expect(drawImage.mock.calls.length, name).toBeGreaterThan(before);
    }
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});

describe("FramesGallery (styleguide)", () => {
  it("lists swim, turn, and expression frames", () => {
    renderWithIntl(<FramesGallery species="great-white" />);
    const gallery = screen.getByRole("heading", {
      name: "畫格一覽",
    }).parentElement!;
    for (const label of [
      "尾巴 1",
      "尾巴 4",
      "轉身 4",
      "朝左",
      "眨眼",
      "吃飽",
      "飢餓",
    ]) {
      expect(within(gallery).getByText(label)).toBeDefined();
    }
    expect(within(gallery).queryByText("爬上缸壁")).toBeNull();
  });

  it("adds the wall frames for the snail", () => {
    renderWithIntl(<FramesGallery species="snail" />);
    expect(screen.getByText("爬上缸壁")).toBeDefined();
    expect(screen.getByText("爬下缸壁")).toBeDefined();
  });
});

describe("FishThumbnail (shop)", () => {
  it("draws the fish's pixel-art portrait", () => {
    const { container } = renderWithIntl(
      <FishThumbnail fish={{ id: "whale-shark", price: 400 }} />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(drawImage).toHaveBeenCalled();
  });
});
