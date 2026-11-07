import { describe, expect, it, vi } from "vitest";
import { azureOpenAiLanguage } from "@/lib/ai/azure-openai";
import { azureSpeech } from "@/lib/ai/azure-speech";
import { geminiLanguage } from "@/lib/ai/gemini";
import { googleSpeech } from "@/lib/ai/google-tts";

/** The free connection checks (D49), against fake answers only. */
const answer = (status: number, body: unknown = {}) =>
  vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );

const config = {
  endpoint: "https://listenloop-ai.openai.azure.com",
  apiKey: "k",
  deployment: "gpt-5-mini",
  model: "gpt-5-mini",
};

describe("Azure OpenAI connection check", () => {
  it("sends an empty conversation the deployment refuses, unbilled", async () => {
    const fetchImpl = answer(400, { error: { code: "invalid_request" } });
    expect(
      await azureOpenAiLanguage(config, fetchImpl).checkConnection?.(),
    ).toEqual({ ok: true, status: 400 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://listenloop-ai.openai.azure.com/openai/v1/chat/completions",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      model: "gpt-5-mini",
      messages: [],
    });
  });

  it.each([
    [401, { error: { code: "401", message: "Access denied" } }, "401"],
    [404, { error: { code: "DeploymentNotFound" } }, "DeploymentNotFound"],
  ])("reports HTTP %i with the provider's code", async (status, body, code) => {
    expect(
      await azureOpenAiLanguage(
        config,
        answer(status, body),
      ).checkConnection?.(),
    ).toEqual({ ok: false, status, code });
  });

  it("reports a timeout without throwing", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("slow", "TimeoutError"));
    expect(
      await azureOpenAiLanguage(config, fetchImpl).checkConnection?.(),
    ).toEqual({ ok: false, code: "timeout" });
  });
});

describe("other providers' checks", () => {
  it("lists Azure voices in the region", async () => {
    const fetchImpl = answer(200, []);
    expect(
      await azureSpeech("k", "uaenorth", fetchImpl).checkConnection?.(),
    ).toEqual({ ok: true, status: 200 });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://uaenorth.tts.speech.microsoft.com/cognitiveservices/voices/list",
    );
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
  });

  it("reads Google's model and voices with GET", async () => {
    const fetchImpl = answer(403, { error: { status: "PERMISSION_DENIED" } });
    expect(await geminiLanguage("k", fetchImpl).checkConnection?.()).toEqual({
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
    });
    expect(
      await googleSpeech("k", answer(200)).checkConnection?.(),
    ).toMatchObject({ ok: true });
  });
});
