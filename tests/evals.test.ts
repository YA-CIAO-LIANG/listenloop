import { describe, expect, it } from "vitest";
import { GOLDEN_SET } from "@/lib/evals/golden";
import { processAnswer, type Processed } from "@/lib/evals/pipeline";
import { spotChecks } from "@/lib/evals/report";
import { checkRule, checkRules, RULES_FOR } from "@/lib/evals/rules";
import {
  baselineOf,
  caseScore,
  gate,
  MissingRecording,
  replayTransport,
  requestHash,
  runCase,
  type Transport,
} from "@/lib/evals/run";
import type { EvalBaseline, EvalCase, EvalFixture } from "@/lib/evals/types";

/**
 * The AI eval (D150): the golden set is well-formed, the rules catch the
 * problems Joe reported, and the gate keeps a worse version from merging.
 */

const byId = (id: string) => {
  const found = GOLDEN_SET.find((c) => c.id === id);
  if (!found) throw new Error(`no case ${id}`);
  return found;
};

const failed = (evalCase: EvalCase, processed: Processed) =>
  checkRules(evalCase, processed)
    .filter((r) => !r.pass)
    .map((r) => r.kind);

/** A chat completion carrying `content` as its JSON answer. */
const completion = (content: unknown) => ({
  choices: [
    {
      finish_reason: "stop",
      message: { content: JSON.stringify(content), refusal: null },
    },
  ],
  usage: { prompt_tokens: 1000, completion_tokens: 100 },
});

describe("the golden set", () => {
  it("has at least 50 cases with unique ids, across every AI step", () => {
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(50);
    expect(new Set(GOLDEN_SET.map((c) => c.id)).size).toBe(GOLDEN_SET.length);
    expect(new Set(GOLDEN_SET.map((c) => c.operation))).toEqual(
      new Set([
        "segment",
        "translate",
        "annotate",
        "compose",
        "describe",
        "revise",
      ]),
    );
  });

  it("uses only rules that apply to each case's step", () => {
    const common = ["valid", "noFullWidth"];
    for (const evalCase of GOLDEN_SET) {
      for (const rule of evalCase.rules) {
        expect(
          [...common, ...RULES_FOR[evalCase.operation]],
          evalCase.id,
        ).toContain(rule.kind);
      }
    }
  });

  it("keeps every problem Joe reported as a regression case", () => {
    const reported = GOLDEN_SET.filter((c) => c.regression).map(
      (c) => c.regression!.issue,
    );
    for (const issue of ["講解太長", "人名", "全形", "恐怖風"]) {
      expect(
        reported.some((text) => text.includes(issue)),
        issue,
      ).toBe(true);
    }
  });
});

describe("rules catch the reported problems", () => {
  it("a horror rewrite that copies the text back fails (D123)", () => {
    const horror = byId("revise-horror");
    if (horror.operation !== "revise") throw new Error();
    // What production got: the 7 lines unchanged, called "changed".
    const copied = processAnswer(horror, {
      status: "changed",
      reason: "",
      lines: horror.input.lines,
    });
    expect(failed(horror, copied)).toEqual(["status", "changedShare"]);

    const rewritten = processAnswer(horror, {
      status: "changed",
      reason: "",
      lines: horror.input.lines.map(
        (line) => `${line} Something was watching.`,
      ),
    });
    expect(failed(horror, rewritten)).toEqual([]);
  });

  it("full-width digits: translation is fixed by the pipeline, a subtitle is caught (D117)", () => {
    const platform = byId("translate-platform");
    const processed = processAnswer(platform, [
      "往高雄的火車 7:15 從第４月台出發。",
    ]);
    expect(processed).toMatchObject({
      lines: ["往高雄的火車 7:15 從第4月台出發。"],
    });
    expect(failed(platform, processed)).toEqual([]);

    const describe = byId("describe-platform");
    const summary = processAnswer(describe, {
      titleEn: "Platform 4",
      titleZh: "第４月台",
      subtitle: "問路：往台南的火車在第４月台",
    });
    expect(failed(describe, summary)).toEqual(["noFullWidth"]);
  });

  it("a name written two ways in one material fails (D117)", () => {
    const names = byId("translate-names");
    const processed = processAnswer(names, [
      "Mei 在公車站等 Alex。",
      "Alex 又遲到了，所以梅打電話給他。",
      "Mei 告訴 Alex 公車要來了。",
    ]);
    const [result] = checkRules(names, processed).filter((r) => !r.pass);
    expect(result.kind).toBe("namesKept");
    expect(result.detail).toContain("第 2 行");
  });

  it("notes the model wrote too long fail, even when the app shortens them (D117)", () => {
    const long = byId("annotate-long");
    const processed: Processed = {
      operation: "annotate",
      notes: [
        {
          v: 2,
          difficulty: "hard",
          highlights: [],
          vocab: [],
          grammar: [],
          chunks: [],
          connected: [],
        },
      ],
      rawChars: [1_250],
    };
    const result = checkRule(long, processed, {
      kind: "rawNotesMaxChars",
      max: 1_100,
    });
    expect(result.pass).toBe(false);
    expect(result.detail).toContain("1250");
  });

  it("gonna before a place fails", () => {
    const library = byId("connected-going-to-place");
    const processed: Processed = {
      operation: "annotate",
      notes: [
        {
          v: 2,
          difficulty: "medium",
          highlights: [],
          vocab: [],
          grammar: [],
          chunks: [],
          connected: [
            { text: "going to", soundsLike: "gonna", note: "常見縮讀" },
          ],
        },
      ],
      rawChars: [300],
    };
    expect(failed(library, processed)).toEqual(["noReduction"]);
  });

  it("a title the learner typed must come back unchanged", () => {
    const titled = byId("compose-title-en");
    const words = Array.from({ length: 100 }, () => "word").join(" ");
    const lines = words.match(/(\S+ ){9}\S+/g)!;
    const processed = processAnswer(titled, {
      title: "Lost in Taipei",
      titleZh: "在台北迷路",
      subtitle: "在車站問路的對話",
      lines: lines.map((l) => `${l} station.`),
    });
    expect(failed(titled, processed)).toContain("titleExact");
  });
});

describe("scoring and the merge gate", () => {
  it("weighs rules and the judge", () => {
    const pass = { pass: true };
    const miss = { pass: false };
    expect(caseScore([pass, pass], null, false)).toBe(100);
    expect(caseScore([pass, miss], null, false)).toBe(50);
    expect(caseScore([pass, pass], { score: 5, reason: "" }, true)).toBe(100);
    expect(caseScore([pass, pass], { score: 3, reason: "" }, true)).toBe(80);
    expect(caseScore([pass, miss], null, true)).toBe(30);
  });

  const baseline = (total: number, version = "new"): EvalBaseline => ({
    version,
    judgeVersion: 1,
    model: "gpt-5-mini",
    total,
    byOperation: {},
    cases: [],
  });

  it("passes at or above main's score, and below it only with an exception", () => {
    expect(gate(baseline(80), null, []).ok).toBe(true);
    expect(gate(baseline(80), baseline(80, "old"), []).ok).toBe(true);
    expect(gate(baseline(81), baseline(80, "old"), []).ok).toBe(true);
    const worse = gate(baseline(79.5), baseline(80, "old"), []);
    expect(worse.ok).toBe(false);
    expect(
      gate(baseline(79.5), baseline(80, "old"), [
        {
          version: "new",
          date: "2026-11-13",
          reason: "換便宜的模型",
          decision: "D999",
        },
      ]),
    ).toMatchObject({ ok: true });
    // An exception for another version doesn't count.
    expect(
      gate(baseline(79.5), baseline(80, "old"), [
        { version: "other", date: "2026-11-13", reason: "", decision: "D999" },
      ]).ok,
    ).toBe(false);
  });

  it("fingerprints the request without the deployment name", () => {
    const body = {
      model: "my-deployment",
      messages: [{ role: "system", content: "a" }],
    };
    expect(requestHash(body)).toBe(requestHash({ ...body, model: "other" }));
    expect(requestHash(body)).not.toBe(
      requestHash({ ...body, messages: [{ role: "system", content: "b" }] }),
    );
  });

  it("replays a recording, and stops when the request changed", async () => {
    const evalCase = byId("translate-taxi");
    const fixtures = new Map<string, EvalFixture>();
    const recorder: Transport = async (caseId, step, body) => {
      const response =
        step === "answer"
          ? completion({
              translations: ["我們搭計程車，因為最後一班公車已經開走了。"],
            })
          : completion({ score: 5, reason: "忠實自然" });
      fixtures.set(`${caseId}:${step}`, {
        requestHash: requestHash(body),
        request: body,
        response,
      });
      return { status: 200, response };
    };
    const recorded = await runCase(evalCase, recorder);
    expect(recorded.score).toBe(100);
    expect(recorded.costUsd).toBeGreaterThan(0);

    const replay = replayTransport(
      (caseId, step) => fixtures.get(`${caseId}:${step}`) ?? null,
    );
    const replayed = await runCase(evalCase, replay);
    expect(replayed).toEqual(recorded);
    expect(baselineOf([replayed]).total).toBe(100);

    // A different prompt (here: a different input) has no recording.
    const changed = { ...evalCase, id: evalCase.id } as EvalCase;
    if (changed.operation === "translate") {
      changed.input = { ...changed.input, lines: ["Another line."] };
    }
    await expect(runCase(changed, replay)).rejects.toBeInstanceOf(
      MissingRecording,
    );
  });

  it("suggests every regression case, and every step, for checking by hand", () => {
    const picked = spotChecks(GOLDEN_SET, "v1");
    for (const evalCase of GOLDEN_SET.filter((c) => c.regression)) {
      expect(picked).toContain(evalCase.id);
    }
    const operations = new Set(picked.map((id) => byId(id).operation));
    expect(operations.size).toBe(6);
    expect(spotChecks(GOLDEN_SET, "v1")).toEqual(picked);
  });
});
