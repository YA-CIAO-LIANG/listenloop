import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PixelFishDemo } from "@/app/styleguide/PixelFishDemo";
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

describe("PixelFishDemo (styleguide)", () => {
  it("swims: starts an animation loop and offers pause and turn", () => {
    screenPrefersReducedMotion(false);
    renderWithIntl(<PixelFishDemo />);
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(
      screen.getByRole("img", { name: "小丑魚在像素風魚缸裡來回游動" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "暫停" }));
    expect(screen.getByRole("button", { name: "播放" })).toBeDefined();
  });

  it("stays still with reduced motion, and Turn flips the fish", () => {
    screenPrefersReducedMotion(true);
    renderWithIntl(<PixelFishDemo />);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "暫停" })).toBeNull();
    expect(screen.getByText(/減少動態效果/)).toBeDefined();

    const drawsBefore = drawImage.mock.calls.length;
    act(() => fireEvent.click(screen.getByRole("button", { name: "轉身" })));
    // Redrawn (tank + fish) facing the other way, still without a loop.
    expect(drawImage.mock.calls.length).toBeGreaterThan(drawsBefore);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("lays out every frame for checking", () => {
    screenPrefersReducedMotion(true);
    renderWithIntl(<PixelFishDemo />);
    for (const label of ["尾巴 1", "尾巴 4", "轉身 1", "轉身 4", "朝左"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });
});
