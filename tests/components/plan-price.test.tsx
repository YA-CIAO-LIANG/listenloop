import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanPrice } from "@/components/PlanPrice";
import { PaidPlanCard } from "@/components/PaidPlanCard";
import { PLAN_PRICES } from "@/lib/payments/pricing";
import { renderWithIntl } from "../render";

/** A month's price is always the big number (D128). */
describe("PlanPrice", () => {
  it("shows a monthly plan's price a month, with no yearly line", () => {
    renderWithIntl(<PlanPrice total={149} period="month" />);
    expect(screen.getByText("NT$149").className).toContain("text-h2");
    expect(screen.getByText("／月")).toBeTruthy();
    expect(screen.queryByText(/一次付清/)).toBeNull();
  });

  it("shows a yearly plan as its average a month, the total paid once under it", () => {
    renderWithIntl(
      <PlanPrice total={PLAN_PRICES.plus.year.amount} period="year" />,
    );
    expect(screen.getByText("NT$124").className).toContain("text-h2");
    const note = screen.getByText(/年繳 NT\$1,490，一次付清，/);
    expect(note.textContent).toBe("年繳 NT$1,490，一次付清，省 2 個月");
    expect(note.className).toContain("text-supporting");
  });

  it("fits a table cell on one line", () => {
    renderWithIntl(
      <PlanPrice
        total={PLAN_PRICES.pro.year.amount}
        period="year"
        size="inline"
      />,
    );
    expect(screen.getByText(/NT\$249／月/).textContent).toBe(
      "NT$249／月 （年繳 NT$2,990）",
    );
  });

  it("is what the upgrade card shows for Plus", () => {
    renderWithIntl(
      <PaidPlanCard
        block={{ limit: "practicesTotal", max: 1 }}
        joined={false}
      />,
    );
    expect(screen.getByText("NT$124")).toBeTruthy();
    expect(screen.queryByText(/即將推出/)).toBeNull();
  });
});
