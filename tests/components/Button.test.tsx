import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/Button";

describe("Button", () => {
  it("is a non-submitting button with the given variant and size", () => {
    render(
      <Button variant="primary" size="lg">
        Start
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Start" });
    expect(button).toHaveProperty("type", "button");
    expect(button.dataset.variant).toBe("primary");
    expect(button.dataset.size).toBe("lg");
  });

  it("hides the optional arrow from screen readers", () => {
    render(<Button arrow>Next</Button>);
    expect(screen.getByRole("button", { name: "Next" })).toBeDefined();
  });

  it.each(["{Enter}", " "])(
    "activates with %j from the keyboard",
    async (key) => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Go</Button>);
      await userEvent.tab();
      await userEvent.keyboard(key);
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it("shows the pressed state while a key is held and adds a ripple", () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });

    fireEvent.keyDown(button, { key: "Enter" });
    expect(button.hasAttribute("data-pressed")).toBe(true);
    expect(button.querySelectorAll("[data-ripple]")).toHaveLength(1);

    fireEvent.keyUp(button, { key: "Enter" });
    expect(button.hasAttribute("data-pressed")).toBe(false);
  });

  it("starts a ripple on pointer down and still calls the caller's handler", () => {
    const onPointerDown = vi.fn();
    render(<Button onPointerDown={onPointerDown}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });

    fireEvent.pointerDown(button, { button: 0, clientX: 5, clientY: 5 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(button.hasAttribute("data-pressed")).toBe(true);
    expect(button.querySelectorAll("[data-ripple]")).toHaveLength(1);

    fireEvent.pointerUp(button);
    expect(button.hasAttribute("data-pressed")).toBe(false);
  });

  it("does nothing when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Go" });

    await userEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(onClick).not.toHaveBeenCalled();
    expect(button.hasAttribute("data-pressed")).toBe(false);
  });
});
