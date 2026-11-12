import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError from "@/app/global-error";

describe("the global error page (D140)", () => {
  it("brings its own phone viewport, since it replaces the layout", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={new Error("x")} reset={() => {}} />,
    );
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    );
  });
});
