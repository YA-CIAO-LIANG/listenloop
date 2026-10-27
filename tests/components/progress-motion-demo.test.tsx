import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProgressMotionDemo } from "@/app/styleguide/ProgressMotionDemo";
import { renderWithIntl } from "../render";

// Prototype for choosing an animation; removed once one option is picked.
describe("ProgressMotionDemo", () => {
  it("shows three options, each starting at 2 of 12", () => {
    renderWithIntl(<ProgressMotionDemo />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars.map((bar) => bar.dataset.variant)).toEqual(["a", "b", "c"]);
    for (const bar of bars) expect(bar.getAttribute("aria-valuenow")).toBe("2");
  });

  it.each([0, 1, 2])("option %s steps, finishes, and resets", async (index) => {
    renderWithIntl(<ProgressMotionDemo />);
    const bar = () => screen.getAllByRole("progressbar")[index];
    const card = bar().closest("section")!;

    await userEvent.click(within(card).getByRole("button", { name: "＋1 句" }));
    expect(bar().getAttribute("aria-valuenow")).toBe("3");

    await userEvent.click(
      within(card).getByRole("button", { name: "全部完成" }),
    );
    expect(bar().getAttribute("aria-valuenow")).toBe("12");
    expect(bar().dataset.done).toBe("true");
    expect(
      within(card)
        .getByRole("button", { name: "＋1 句" })
        .hasAttribute("disabled"),
    ).toBe(true);

    await userEvent.click(within(card).getByRole("button", { name: "重設" }));
    expect(bar().getAttribute("aria-valuenow")).toBe("0");
  });

  it("keeps the number visible in option C's split label", () => {
    renderWithIntl(<ProgressMotionDemo />);
    const bar = screen.getAllByRole("progressbar")[2];
    expect(bar.textContent).toContain("第 3 / 12 句");
  });
});
