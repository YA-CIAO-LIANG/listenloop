/**
 * The shape of version 2 notes as the model returns them (D67), as JSON
 * Schema in strict form (every property required, nothing else allowed):
 * Azure OpenAI takes it as is, Gemini through toGeminiSchema. Arrays may
 * be empty where a part doesn't apply. lib/custom-practice/rich-notes.ts
 * checks every answer.
 */
const STRING = { type: "string" } as const;
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const array = (items: unknown) => ({ type: "array", items });
const EXAMPLE = object({ en: STRING, zh: STRING });

export const RICH_NOTES_SCHEMA = object({
  sentences: array(
    object({
      index: { type: "integer" },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      highlights: array(object({ text: STRING, note: STRING })),
      vocab: array(
        object({
          term: STRING,
          inSentence: STRING,
          kind: { type: "string", enum: ["word", "phrase", "idiom"] },
          pos: STRING,
          zh: STRING,
          ipa: STRING,
          collocations: array(STRING),
          examples: array(EXAMPLE),
        }),
      ),
      grammar: array(
        object({
          point: STRING,
          quote: STRING,
          explanation: STRING,
          examples: array(EXAMPLE),
          pitfall: STRING,
        }),
      ),
      chunks: array(
        object({
          text: STRING,
          role: {
            type: "string",
            enum: ["main", "subordinate", "modifier", "connector"],
          },
          zh: STRING,
        }),
      ),
      connected: array(
        object({ text: STRING, soundsLike: STRING, note: STRING }),
      ),
    }),
  ),
});

type Schema = Record<string, unknown>;

/**
 * JSON Schema as Gemini's responseSchema (OpenAPI subset): upper-case
 * types, no additionalProperties.
 */
export function toGeminiSchema(schema: unknown): Schema {
  const s = schema as Schema;
  const out: Schema = { type: String(s.type).toUpperCase() };
  if (s.enum) out.enum = s.enum;
  if (s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties as Record<string, unknown>).map(([k, v]) => [
        k,
        toGeminiSchema(v),
      ]),
    );
    out.required = s.required;
  }
  if (s.items) out.items = toGeminiSchema(s.items);
  return out;
}
