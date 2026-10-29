import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { getAllVideos } from "@/lib/video-library";
import { renderWithIntl } from "../render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("home practice library", () => {
  it("groups videos under their collection's heading", async () => {
    renderWithIntl(<Home />);
    await act(async () => {});
    const heading = screen.getByRole("heading", {
      level: 3,
      name: /Blender 開放電影/,
    });
    const count = getAllVideos().length;
    expect(heading.textContent).toContain(`${count} 支影片`);
    const group = screen.getByRole("region", { name: /Blender 開放電影/ });
    expect(within(group).getByText(/CC BY 授權釋出/)).toBeDefined();
    expect(within(group).getAllByRole("link")).toHaveLength(count);
    expect(within(group).getByText("Sintel").getAttribute("lang")).toBe("en");
  });
});
