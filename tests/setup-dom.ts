import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered components and reset browser state between tests.
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
