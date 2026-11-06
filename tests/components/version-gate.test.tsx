import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionGate } from "@/components/VersionGate";
import { createProgress, type Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { renderWithIntl } from "../render";

const navigation = vi.hoisted(() => ({
  query: "retry=1",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/videos/p-1/day/2",
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const id = "p-00000000-0000-4000-8000-000000000001";
const store = (progress: Progress | null): ProgressStore => ({
  get: async () => progress,
  save: vi.fn(),
  list: async () => [],
  remove: vi.fn(),
});

async function renderGate(progress: Progress | null, version?: number) {
  renderWithIntl(
    <VersionGate videoId={id} version={version} store={store(progress)}>
      <p>練習</p>
    </VersionGate>,
  );
  await act(async () => {});
}

beforeEach(() => {
  navigation.query = "retry=1";
  navigation.replace.mockReset();
});

describe("VersionGate", () => {
  it("reloads a week fixed to another version on that version, keeping the query", async () => {
    await renderGate(
      { ...createProgress(id, "2026-11-01"), materialVersion: 1 },
      2,
    );
    expect(screen.queryByText("練習")).toBeNull();
    expect(navigation.replace).toHaveBeenCalledWith(
      "/videos/p-1/day/2?retry=1&v=1",
    );
  });

  it("shows the practice when the versions match", async () => {
    await renderGate(
      { ...createProgress(id, "2026-11-01"), materialVersion: 2 },
      2,
    );
    expect(screen.getByText("練習")).toBeDefined();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("shows the practice for a new learner, and for built-in videos", async () => {
    await renderGate(null, 2);
    expect(screen.getByText("練習")).toBeDefined();
  });

  it("doesn't loop when the asked version wasn't kept", async () => {
    navigation.query = "v=1";
    await renderGate(
      { ...createProgress(id, "2026-11-01"), materialVersion: 1 },
      2,
    );
    expect(screen.getByText("練習")).toBeDefined();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
