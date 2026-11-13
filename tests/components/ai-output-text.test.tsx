import { describe, expect, it } from "vitest";
import { SentenceExplanation } from "@/components/SentenceExplanation";
import { renderWithIntl } from "../render";

/**
 * AI output is shown as plain text, never as HTML (D159): a model coaxed
 * into writing markup puts characters on the screen, not elements.
 */
const html = '<img src="x" onerror="alert(1)">';
const script = "<script>alert(1)</script>";

describe("AI output is plain text (D159)", () => {
  it("shows markup in notes and translations as text", () => {
    const { container } = renderWithIntl(
      <SentenceExplanation
        en={`Say ${html} now.`}
        zh={script}
        rich={null}
        legacy={{
          vocab: [
            { sentence: 0, word: html, pos: "n.", zh: script, example: html },
          ],
          grammar: [
            {
              sentence: 0,
              point: script,
              explanation: html,
              example: "<b>bold</b>",
            },
          ],
        }}
        missed={null}
        showSentence
      />,
    );
    expect(container.querySelector("img, script, b")).toBeNull();
    expect(container.textContent).toContain(html);
    expect(container.textContent).toContain(script);
  });
});
