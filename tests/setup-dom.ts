import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no canvas. Pixel-art components already skip drawing without a
// 2D context; this just keeps jsdom's "not implemented" noise out of the
// test output. Tests that check drawing mock getContext themselves.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

// Unmount rendered components and reset browser state between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
