"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import {
  generatePracticeAudio,
  generatePracticeNotes,
} from "@/app/materials/actions";
import {
  savePracticeEdit,
  type SaveEditResult,
} from "@/app/materials/edit-actions";
import {
  canSplitAt,
  mergeWithNext,
  PRACTICE_LIMITS,
  splitRowAt,
} from "@/lib/custom-practice/draft";
import {
  editSentences,
  rowsFromSentences,
  type EditRow,
  type EditSentence,
  type PracticeEdit,
} from "@/lib/custom-practice/edit";
import {
  NOTES_PER_SENTENCE,
  type SentenceNotes,
} from "@/lib/custom-practice/notes";
import { customPracticeId } from "@/lib/practice-material";
import { Button } from "./Button";
import { fieldClassName } from "./CreatePracticeForm";
import {
  prepareForPractice,
  type GenerateAudio,
  type GenerateNotes,
  type Stage,
} from "./practice-generation";
import { StageProgress } from "./StageProgress";
import { VoiceMenu, voiceSampleUrl } from "./VoiceMenu";

type EditPracticeFormProps = {
  practice: {
    id: string;
    title: string;
    voice: string;
    version: number;
    sentences: EditSentence[];
  };
  /** Injected in tests; the Server Actions otherwise. */
  save?: (id: string, edit: PracticeEdit) => Promise<SaveEditResult>;
  generate?: GenerateAudio;
  generateNotes?: GenerateNotes;
};

type Failure = Exclude<SaveEditResult, { ok: true }>;

const smallField = `${fieldClassName} py-2 text-supporting`;

/**
 * Editing a created practice (e+ 9c, D45): its title, voice, and
 * sentences (add, delete, merge, split, reorder), each sentence's Chinese
 * and notes. Saving makes a new version (D44); then only what changed is
 * made again (notes, audio), with the same progress bar as creating.
 */
export function EditPracticeForm({
  practice,
  save = savePracticeEdit,
  generate = generatePracticeAudio,
  generateNotes = generatePracticeNotes,
}: EditPracticeFormProps) {
  const t = useTranslations("editPractice");
  const tCreate = useTranslations("create");
  const router = useRouter();
  const ids = { title: useId(), hint: useId() };
  const [title, setTitle] = useState(practice.title);
  const [voice, setVoice] = useState(practice.voice);
  const [rows, setRows] = useState<EditRow[]>(() =>
    rowsFromSentences(practice.sentences),
  );
  const nextKey = useRef(practice.sentences.length);
  const [carets, setCarets] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Stage | null>(null);
  const [failure, setFailure] = useState<
    Failure | { reason: "prepare" } | null
  >(null);
  const [saved, setSaved] = useState(false);

  const newRow = (en: string): EditRow => ({
    key: nextKey.current++,
    en,
    zh: "",
    notes: null,
    original: null,
    notesEdited: false,
  });
  const update = (key: number, change: Partial<EditRow>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  const move = (index: number, by: -1 | 1) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  async function submit() {
    setPending(true);
    setFailure(null);
    setSaved(false);
    const result = await save(practice.id, {
      expectedVersion: practice.version,
      title,
      voice,
      sentences: editSentences(rows),
    }).catch((): SaveEditResult => ({ ok: false, reason: "failed" }));
    if (!result.ok) {
      setFailure(result);
      setPending(false);
      return;
    }
    const ready = await prepareForPractice(
      { generate, generateNotes },
      { id: practice.id, notesReady: result.notesReady, total: result.total },
      setProgress,
    );
    setProgress(null);
    setPending(false);
    if (!ready.ok) {
      setFailure({ reason: "prepare" });
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const failureMessage = (() => {
    if (!failure) return null;
    if (failure.reason === "invalid") {
      const sentence = "sentence" in failure ? failure.sentence : undefined;
      return t(`problems.${failure.problem}`, {
        n: sentence === undefined ? 0 : sentence + 1,
      });
    }
    return t(`errors.${failure.reason}`);
  })();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label htmlFor={ids.title} className="font-medium">
          {tCreate("titleLabel")}
        </label>
        <input
          id={ids.title}
          value={title}
          maxLength={PRACTICE_LIMITS.titleChars}
          onChange={(event) => setTitle(event.target.value)}
          disabled={pending}
          className={fieldClassName}
        />
      </div>

      <section aria-labelledby={`${ids.title}-sentences`} className="space-y-4">
        <div>
          <h2 id={`${ids.title}-sentences`} className="font-display text-h2">
            {t("sentencesTitle")}
          </h2>
          <p id={ids.hint} className="mt-2 text-supporting text-ink-muted">
            {t("sentencesHint")}
          </p>
          <p className="mt-2 text-supporting text-ink-muted">
            {tCreate("sentenceCount", { count: rows.length })}
          </p>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {rows.map((row, index) => {
            const n = index + 1;
            const changed = !row.original || row.en.trim() !== row.original.en;
            return (
              <li key={row.key} className="flex gap-4 py-4">
                <span
                  aria-hidden="true"
                  className="w-6 shrink-0 pt-3 text-metadata text-ink-muted tabular-nums"
                >
                  {String(n).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <textarea
                    aria-label={tCreate("sentenceEn", { n })}
                    aria-describedby={ids.hint}
                    lang="en"
                    rows={2}
                    value={row.en}
                    onChange={(event) =>
                      update(row.key, { en: event.target.value })
                    }
                    onSelect={(event) => {
                      const at = event.currentTarget.selectionStart;
                      setCarets((current) => ({ ...current, [row.key]: at }));
                    }}
                    disabled={pending}
                    className={`${fieldClassName} resize-y text-sentence`}
                  />
                  <textarea
                    aria-label={tCreate("sentenceZh", { n })}
                    lang="zh-Hant"
                    rows={1}
                    value={row.zh}
                    placeholder={t("zhPlaceholder")}
                    onChange={(event) =>
                      update(row.key, { zh: event.target.value })
                    }
                    disabled={pending}
                    className={`${fieldClassName} resize-y text-supporting`}
                  />
                  {changed && (
                    <p className="text-supporting text-accent-ink">
                      {t("changedNote")}
                    </p>
                  )}
                  <NotesEditor
                    n={n}
                    notes={row.notes}
                    willRegenerate={changed && !row.notesEdited}
                    disabled={pending}
                    onChange={(notes) =>
                      update(row.key, { notes, notesEdited: true })
                    }
                  />
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("moveUpLabel", { n })}
                      onClick={() => move(index, -1)}
                      disabled={pending || index === 0}
                    >
                      {t("moveUp")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("moveDownLabel", { n })}
                      onClick={() => move(index, 1)}
                      disabled={pending || index === rows.length - 1}
                    >
                      {t("moveDown")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={tCreate("splitSentenceLabel", { n })}
                      onClick={() =>
                        setRows((current) =>
                          splitRowAt(
                            current,
                            index,
                            carets[row.key] ?? 0,
                            newRow,
                          ),
                        )
                      }
                      disabled={
                        pending ||
                        rows.length >= PRACTICE_LIMITS.sentences ||
                        !canSplitAt(row.en, carets[row.key] ?? 0)
                      }
                    >
                      {tCreate("splitSentence")}
                    </Button>
                    {index < rows.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={tCreate("mergeSentenceLabel", { n })}
                        onClick={() =>
                          setRows((current) => mergeWithNext(current, index))
                        }
                        disabled={pending}
                      >
                        {tCreate("mergeSentence")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={tCreate("removeSentenceLabel", { n })}
                      onClick={() =>
                        setRows((current) =>
                          current.filter((r) => r.key !== row.key),
                        )
                      }
                      disabled={pending || rows.length === 1}
                    >
                      {tCreate("removeSentence")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Button
          size="sm"
          onClick={() => setRows((current) => [...current, newRow("")])}
          disabled={pending || rows.length >= PRACTICE_LIMITS.sentences}
        >
          {tCreate("addSentence")}
        </Button>
      </section>

      <section aria-labelledby={`${ids.title}-voice`} className="space-y-3">
        <h2 id={`${ids.title}-voice`} className="font-display text-h2">
          {tCreate("voiceTitle")}
        </h2>
        <VoiceMenu
          value={voice}
          onChange={setVoice}
          sampleUrl={voiceSampleUrl}
          disabled={pending}
        />
        <p className="text-supporting text-ink-muted">{t("voiceNote")}</p>
      </section>

      <div className="space-y-3">
        <p className="text-supporting text-ink-muted">{t("versionNote")}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={submit} disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
          <Link
            href="/materials"
            className="inline-flex h-10 items-center px-4 text-ink-muted hover:text-ink"
          >
            {t("cancel")}
          </Link>
        </div>
        {progress && <StageProgress stage={progress} className="max-w-sm" />}
        {failureMessage && (
          <p role="alert" className="text-supporting text-error">
            {failureMessage}
          </p>
        )}
        {saved && (
          <p role="status" className="text-supporting text-success">
            {t("saved")}{" "}
            <Link
              href={`/videos/${customPracticeId(practice.id)}`}
              className="text-accent-ink underline underline-offset-4"
            >
              {t("openPractice")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * One sentence's notes, folded away: its vocabulary (word, part of
 * speech, Chinese, example) and grammar (pattern, explanation, example),
 * up to the per-sentence limits. Notes left to be made show that instead,
 * with a way to write them by hand.
 */
function NotesEditor({
  n,
  notes,
  willRegenerate,
  disabled,
  onChange,
}: {
  n: number;
  notes: SentenceNotes | null;
  willRegenerate: boolean;
  disabled: boolean;
  onChange: (notes: SentenceNotes) => void;
}) {
  const t = useTranslations("editPractice");
  const shown = willRegenerate ? null : notes;
  const vocab = shown?.vocab ?? [];
  const grammar = shown?.grammar ?? [];
  const set = (change: Partial<SentenceNotes>) =>
    onChange({ vocab, grammar, ...change });

  return (
    <details className="rounded-base border border-line px-4 py-2">
      <summary className="cursor-pointer text-supporting text-ink-muted">
        {shown
          ? t("notesSummary", { vocab: vocab.length, grammar: grammar.length })
          : t("notesRegenerate")}
      </summary>
      <div className="space-y-4 py-3">
        {!shown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ vocab: [], grammar: [] })}
            disabled={disabled}
          >
            {t("writeNotes")}
          </Button>
        )}
        {shown && (
          <>
            <fieldset className="space-y-3">
              <legend className="text-metadata tracking-widest text-ink-muted uppercase">
                {t("vocab")}
              </legend>
              {vocab.map((item, k) => (
                <div key={k} className="grid gap-2 split:grid-cols-2">
                  <input
                    aria-label={t("vocabWord", { n, k: k + 1 })}
                    lang="en"
                    value={item.word}
                    onChange={(e) =>
                      set({
                        vocab: vocab.map((v, j) =>
                          j === k ? { ...v, word: e.target.value } : v,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={smallField}
                  />
                  <input
                    aria-label={t("vocabPos", { n, k: k + 1 })}
                    value={item.pos}
                    onChange={(e) =>
                      set({
                        vocab: vocab.map((v, j) =>
                          j === k ? { ...v, pos: e.target.value } : v,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={smallField}
                  />
                  <input
                    aria-label={t("vocabZh", { n, k: k + 1 })}
                    value={item.zh}
                    onChange={(e) =>
                      set({
                        vocab: vocab.map((v, j) =>
                          j === k ? { ...v, zh: e.target.value } : v,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={smallField}
                  />
                  <input
                    aria-label={t("vocabExample", { n, k: k + 1 })}
                    lang="en"
                    value={item.example}
                    onChange={(e) =>
                      set({
                        vocab: vocab.map((v, j) =>
                          j === k ? { ...v, example: e.target.value } : v,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={smallField}
                  />
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("removeVocabLabel", { n, k: k + 1 })}
                      onClick={() =>
                        set({ vocab: vocab.filter((_, j) => j !== k) })
                      }
                      disabled={disabled}
                    >
                      {t("remove")}
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  set({
                    vocab: [
                      ...vocab,
                      { word: "", pos: "", zh: "", example: "" },
                    ],
                  })
                }
                disabled={disabled || vocab.length >= NOTES_PER_SENTENCE.vocab}
              >
                {t("addVocab")}
              </Button>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-metadata tracking-widest text-ink-muted uppercase">
                {t("grammar")}
              </legend>
              {grammar.map((point, k) => (
                <div key={k} className="grid gap-2">
                  <input
                    aria-label={t("grammarPoint", { n, k: k + 1 })}
                    lang="en"
                    value={point.point}
                    onChange={(e) =>
                      set({
                        grammar: grammar.map((g, j) =>
                          j === k ? { ...g, point: e.target.value } : g,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={smallField}
                  />
                  <textarea
                    aria-label={t("grammarExplanation", { n, k: k + 1 })}
                    rows={2}
                    value={point.explanation}
                    onChange={(e) =>
                      set({
                        grammar: grammar.map((g, j) =>
                          j === k ? { ...g, explanation: e.target.value } : g,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={`${smallField} resize-y`}
                  />
                  <input
                    aria-label={t("grammarExample", { n, k: k + 1 })}
                    lang="en"
                    value={point.example}
                    onChange={(e) =>
                      set({
                        grammar: grammar.map((g, j) =>
                          j === k ? { ...g, example: e.target.value } : g,
                        ),
                      })
                    }
                    disabled={disabled}
                    className={smallField}
                  />
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t("removeGrammarLabel", { n, k: k + 1 })}
                      onClick={() =>
                        set({ grammar: grammar.filter((_, j) => j !== k) })
                      }
                      disabled={disabled}
                    >
                      {t("remove")}
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  set({
                    grammar: [
                      ...grammar,
                      { point: "", explanation: "", example: "" },
                    ],
                  })
                }
                disabled={
                  disabled || grammar.length >= NOTES_PER_SENTENCE.grammar
                }
              >
                {t("addGrammar")}
              </Button>
            </fieldset>
          </>
        )}
      </div>
    </details>
  );
}
