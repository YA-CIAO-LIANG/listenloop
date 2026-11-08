import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassRulesSettings } from "@/components/PassRulesSettings";
import { PlanProvider } from "@/components/PlanProvider";
import type { PlanId } from "@/lib/plans";
import { createProgress, type Progress } from "@/lib/progress";
import type { ProgressStore } from "@/lib/storage/progress-store";
import { renderWithIntl } from "../render";

function storeWith(progress: Progress | null) {
  const store: ProgressStore = {
    get: vi.fn(async () => progress),
    save: vi.fn(async () => {}),
    list: vi.fn(async () => (progress ? [progress] : [])),
    remove: vi.fn(async () => {}),
  };
  return store;
}

async function renderSettings(plan: PlanId, progress: Progress | null) {
  const store = storeWith(progress);
  renderWithIntl(
    <PlanProvider plan={plan}>
      <PassRulesSettings videoId="sintel" store={store} />
    </PlanProvider>,
  );
  await act(async () => {});
  return store;
}

const started = createProgress("sintel", "2026-11-08");
const select = (name: RegExp) => screen.getByRole("combobox", { name });

describe("PassRulesSettings (D92)", () => {
  it("shows the defaults, locked, with a link to the plans on the free plan", async () => {
    await renderSettings("free", started);
    expect(select(/聽寫最低正確率/).hasAttribute("disabled")).toBe(true);
    expect((select(/跟讀每句/) as HTMLSelectElement).value).toBe("0.6");
    expect((select(/第 7 天/) as HTMLSelectElement).value).toBe("improve");
    expect(
      screen.getByRole("link", { name: "看方案" }).getAttribute("href"),
    ).toBe("/pricing?from=custom-rules");
  });

  it("saves a change into the practice's progress on a paid plan", async () => {
    const store = await renderSettings("paid", started);
    fireEvent.change(select(/第 7 天/), { target: { value: "0.8" } });
    await act(async () => {});
    expect(store.save).toHaveBeenLastCalledWith({
      ...started,
      rules: {
        dictationMin: 0,
        shadowingMin: 0.6,
        day7: { kind: "score", min: 0.8 },
      },
    });
    expect(screen.getByText("已儲存。")).toBeDefined();
  });

  it("drops the field when the rules are back to the defaults", async () => {
    const store = await renderSettings("paid", {
      ...started,
      rules: { dictationMin: 0, shadowingMin: 0.8, day7: { kind: "improve" } },
    });
    fireEvent.change(select(/跟讀每句/), { target: { value: "0.6" } });
    await act(async () => {});
    expect(store.save).toHaveBeenLastCalledWith(started);
  });

  it("waits for the practice to start before it can change", async () => {
    await renderSettings("paid", null);
    expect(select(/聽寫最低正確率/).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("開始第 1 天之後就可以調整。")).toBeDefined();
  });
});
