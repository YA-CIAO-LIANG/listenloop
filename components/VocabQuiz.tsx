"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { wordAudioUrl } from "@/app/videos/[id]/quiz/actions";
import { updateActivity } from "@/lib/claim-rewards";
import { toLocalDate } from "@/lib/dates";
import type { PracticeMaterial } from "@/lib/practice-material";
import { saveQuizAttempt } from "@/lib/quiz-records";
import { addMisses } from "@/lib/review";
import { loadBrowserSupabase } from "@/lib/supabase/browser";
import {
  choicesFor,
  compareSpelling,
  distractors,
  misheardWords,
  pickQuizWords,
  QUIZ,
  quizMisses,
  quizSummary,
  spellingHint,
  type LetterMark,
  type PoolWord,
  type QuizWord,
  type WordResult,
} from "@/lib/vocab-quiz";
import { Button } from "./Button";
import { ButtonLink } from "./ButtonLink";
import { PracticeActions, PracticeActionsSpacer } from "./PracticeActions";
import { useStores } from "./StoresProvider";
import { usePracticeTimer } from "./usePracticeTimer";

const fieldClassName =
  "block w-full max-w-sm rounded-base border border-line bg-surface px-4 py-3 text-sentence focus-visible:border-accent";

/** The browser's own voice, when no recorded word is available. */
function speakWithBrowser(word: string, lang: string, rate: number) {
  try {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = lang;
    utterance.rate = rate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // No speech synthesis: the word can still be spelled from the hints.
  }
}

const ACCENT_LANGS: Record<string, string> = {
  us: "en-US",
  gb: "en-GB",
  au: "en-AU",
  in: "en-IN",
};

export type VocabQuizProps = {
  video: PracticeMaterial;
  day: 1 | 7;
  /** Every word this material's quiz can ask (server-picked). */
  candidates: QuizWord[];
  /** Other materials' words, for wrong answers. */
  others: PoolWord[];
  /** The accent the words are said in, for the browser's voice. */
  accent: string;
  /** Injected in tests. */
  audioUrl?: typeof wordAudioUrl;
  save?: typeof saveQuizAttempt;
};

/**
 * The vocabulary quiz after dictation (D136): for each word, spell it
 * from its sound (replay, slowly, with hints), then choose its Chinese;
 * then the results, and the words missed go on the review list. Scores
 * are kept apart from dictation: they never change a day's result.
 */
export function VocabQuiz(props: VocabQuizProps) {
  const t = useTranslations("quiz");
  const { progress: progressStore } = useStores();
  const [answers, setAnswers] = useState<
    readonly (string | null)[] | "locked" | null
  >(null);
  const { video, day } = props;

  useEffect(() => {
    let cancelled = false;
    progressStore
      .get(video.id)
      .then((progress) => {
        if (cancelled) return;
        const done = progress?.days[day]?.done;
        setAnswers(done ? (progress?.days[day]?.answers ?? []) : "locked");
      })
      .catch(() => {
        if (!cancelled) setAnswers("locked");
      });
    return () => {
      cancelled = true;
    };
  }, [progressStore, video.id, day]);

  if (answers === null) {
    return (
      <p role="status" className="text-ink-muted">
        {t("loading")}
      </p>
    );
  }
  if (answers === "locked") {
    return (
      <div className="space-y-4">
        <p className="max-w-reading">{t("locked", { day })}</p>
        <ButtonLink
          href={`/videos/${video.id}/day/${day}`}
          variant="primary"
          arrow
        >
          {t("goDay", { day })}
        </ButtonLink>
      </div>
    );
  }
  return <Quiz {...props} answers={answers} />;
}

type Step = "spell" | "spelled" | "choose" | "chosen";

function Quiz({
  video,
  day,
  candidates,
  others,
  accent,
  answers,
  audioUrl = wordAudioUrl,
  save = saveQuizAttempt,
}: VocabQuizProps & { answers: readonly (string | null)[] }) {
  const t = useTranslations("quiz");
  const { rewards } = useStores();
  // The quiz counts as practice time (D181).
  usePracticeTimer(video.id, false);
  const ids = { input: useId(), hint: useId(), choices: useId() };
  const words = useMemo(
    () => pickQuizWords(candidates, misheardWords(video.sentences, answers)),
    [candidates, video.sentences, answers],
  );
  const pool = useMemo(
    () => candidates.map(({ word, pos, zh }) => ({ word, pos, zh })),
    [candidates],
  );
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState<Step>("spell");
  const [typed, setTyped] = useState("");
  const [hints, setHints] = useState<0 | 1 | 2>(0);
  const [marks, setMarks] = useState<LetterMark[] | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [results, setResults] = useState<WordResult[]>([]);
  const [saved, setSaved] = useState<"saved" | "signed-out" | "failed" | null>(
    null,
  );
  const word = words[index] as QuizWord | undefined;
  const input = useRef<HTMLInputElement>(null);

  // The word's sound: the shared recording, else the browser's voice.
  const audio = useRef<HTMLAudioElement | null>(null);
  const [sound, setSound] = useState<{ word: string; url: string | null }>();
  const play = useCallback(
    (slow = false) => {
      if (!word) return;
      const rate = slow ? QUIZ.slowRate : 1;
      if (sound?.word === word.word && sound.url) {
        const element = (audio.current ??= new Audio());
        if (element.src !== sound.url) element.src = sound.url;
        element.preservesPitch = true;
        element.playbackRate = rate;
        element.currentTime = 0;
        void element.play().catch(() => {});
      } else {
        speakWithBrowser(word.word, ACCENT_LANGS[accent] ?? "en-US", rate);
      }
    },
    [word, sound, accent],
  );
  useEffect(() => {
    if (!word) return;
    let cancelled = false;
    void audioUrl(video.id, word.word)
      .catch(() => ({ ok: false as const }))
      .then((result) => {
        if (cancelled) return;
        setSound({ word: word.word, url: result.ok ? result.url : null });
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl, video.id, word, round]);
  // Played once on arriving at each word.
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!word || sound?.word !== word.word) return;
    const key = `${round}:${index}`;
    if (played.current === key) return;
    played.current = key;
    play();
  }, [sound, word, play, round, index]);

  const choices = useMemo(
    () => (word ? choicesFor(word, distractors(word, pool, others)) : []),
    [word, pool, others],
  );

  if (words.length === 0) {
    return (
      <div className="space-y-4">
        <p className="max-w-reading">{t("noWords")}</p>
        <ButtonLink href={`/videos/${video.id}`} variant="secondary">
          {t("backToVideo")}
        </ButtonLink>
      </div>
    );
  }

  const finished = index >= words.length;
  if (finished) {
    return (
      <Result
        video={video}
        results={results}
        saved={saved}
        onRetry={() => {
          setRound((r) => r + 1);
          setIndex(0);
          setStep("spell");
          setTyped("");
          setHints(0);
          setMarks(null);
          setChoice(null);
          setResults([]);
          setSaved(null);
        }}
      />
    );
  }

  const current = word!;
  const spelling = marks ? compareSpelling(current.word, typed) : null;

  async function finish(all: WordResult[]) {
    const summary = quizSummary(all);
    // Missed words go on the review list (D108), signed in or not.
    const misses = quizMisses(words, summary.missed, video);
    if (misses.length > 0) {
      await updateActivity(rewards, (activity) => ({
        ...activity,
        review: addMisses(
          activity.review ?? {},
          misses,
          toLocalDate(new Date()),
          new Date(),
        ),
      })).catch(() => {});
    }
    const supabase = await loadBrowserSupabase().catch(() => null);
    setSaved(
      await save(supabase, {
        videoId: video.id,
        day,
        summary,
        words: all,
      }).catch(() => "failed" as const),
    );
  }

  function submitSpelling(event: React.FormEvent) {
    event.preventDefault();
    if (!typed.trim()) return;
    setMarks(compareSpelling(current.word, typed).marks);
    setStep("spelled");
  }

  function submitChoice(event: React.FormEvent) {
    event.preventDefault();
    if (!choice) return;
    setStep("chosen");
  }

  function next() {
    const result: WordResult = {
      word: current.word,
      spelled: compareSpelling(current.word, typed).correct,
      hints,
      translated: choice === current.zh,
    };
    const all = [...results, result];
    setResults(all);
    setIndex((i) => i + 1);
    setStep("spell");
    setTyped("");
    setHints(0);
    setMarks(null);
    setChoice(null);
    if (all.length === words.length) void finish(all);
    else window.setTimeout(() => input.current?.focus(), 0);
  }

  const hint = spellingHint(current.word, hints);

  return (
    <div className="space-y-6">
      <p className="text-supporting text-ink-muted" aria-live="polite">
        {t("progress", { n: index + 1, total: words.length })} ·{" "}
        {t(step === "spell" || step === "spelled" ? "stepSpell" : "stepChoose")}
      </p>

      {(step === "spell" || step === "spelled") && (
        <form onSubmit={submitSpelling} className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => play()}>
              {t("replay")}
            </Button>
            <Button variant="secondary" onClick={() => play(true)}>
              {t("slow")}
            </Button>
            {step === "spell" && hints < 2 && (
              <Button
                variant="ghost"
                onClick={() => setHints((h) => (h === 0 ? 1 : 2))}
              >
                {hints === 0 ? t("hintLength") : t("hintFirst")}
              </Button>
            )}
          </div>
          {hint && (
            <p
              id={ids.hint}
              lang="en"
              className="font-mono text-h3 tracking-widest"
              aria-label={
                hints === 2
                  ? t("hintFirstLabel", {
                      count: [...current.word].length,
                      first: current.word[0],
                    })
                  : t("hintLengthLabel", { count: [...current.word].length })
              }
            >
              {hint}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor={ids.input} className="block font-medium">
              {t("spellLabel")}
            </label>
            <input
              id={ids.input}
              ref={input}
              lang="en"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={typed}
              readOnly={step === "spelled"}
              aria-describedby={hint ? ids.hint : undefined}
              onChange={(event) => setTyped(event.target.value)}
              className={fieldClassName}
            />
          </div>
          {spelling && (
            <div role="status" className="space-y-2">
              <p
                className={
                  spelling.correct
                    ? "font-medium text-success"
                    : "font-medium text-error"
                }
              >
                {spelling.correct ? t("spellRight") : t("spellWrong")}
              </p>
              {!spelling.correct && (
                <p
                  lang="en"
                  className="text-sentence"
                  aria-label={t("answerIs", { word: current.word })}
                >
                  {spelling.marks.map((mark, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={
                        mark.kind === "right"
                          ? "text-ink"
                          : mark.kind === "extra"
                            ? "text-error line-through"
                            : "rounded-sm bg-error/15 text-error underline decoration-2 underline-offset-4"
                      }
                    >
                      {mark.char}
                    </span>
                  ))}
                </p>
              )}
              {!spelling.correct && (
                <p className="text-supporting text-ink-muted">
                  {t("marksLegend")}
                </p>
              )}
            </div>
          )}
          <PracticeActions
            primary={
              step === "spell" ? (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!typed.trim()}
                >
                  {t("check")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  arrow
                  onClick={() => setStep("choose")}
                >
                  {t("toChoose")}
                </Button>
              )
            }
          />
        </form>
      )}

      {(step === "choose" || step === "chosen") && (
        <form onSubmit={submitChoice} className="space-y-4">
          <fieldset className="space-y-2" aria-describedby={ids.choices}>
            <legend className="font-medium">
              {t("chooseLegend")}{" "}
              <span lang="en" className="font-display text-h3">
                {current.word}
              </span>
            </legend>
            <p id={ids.choices} className="text-supporting text-ink-muted">
              {t("chooseHint")}
            </p>
            {choices.map((option) => {
              const right = option === current.zh;
              const picked = option === choice;
              const shown = step === "chosen";
              return (
                <label
                  key={option}
                  className={`flex items-center gap-3 rounded-base border px-4 py-3 pointer-coarse:min-h-11 ${
                    shown && right
                      ? "border-success"
                      : shown && picked
                        ? "border-error"
                        : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name={`choice-${index}`}
                    value={option}
                    checked={picked}
                    disabled={shown}
                    onChange={() => setChoice(option)}
                    className="size-4 accent-accent"
                  />
                  <span lang="zh-Hant">{option}</span>
                  {shown && right && (
                    <span className="ml-auto text-supporting text-success">
                      {t("rightAnswer")}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
          {step === "chosen" && (
            <div
              role="status"
              className="space-y-2 rounded-base border border-line bg-band p-4"
            >
              <p
                className={
                  choice === current.zh
                    ? "font-medium text-success"
                    : "font-medium text-error"
                }
              >
                {choice === current.zh ? t("chooseRight") : t("chooseWrong")}
              </p>
              <p>
                <span lang="en" className="font-medium">
                  {current.word}
                </span>{" "}
                <span className="text-ink-muted">{current.pos}</span>{" "}
                <span lang="zh-Hant">{current.zh}</span>
              </p>
              {current.example ? (
                <p className="text-supporting">
                  <span lang="en" className="block">
                    {current.example.en}
                  </span>
                  {current.example.zh && (
                    <span lang="zh-Hant" className="block text-ink-muted">
                      {current.example.zh}
                    </span>
                  )}
                </p>
              ) : null}
              {!current.example?.zh && video.sentences[current.sentence] && (
                <p className="text-supporting">
                  <span className="text-ink-muted">{t("fromSentence")} </span>
                  <span lang="en" className="block">
                    {video.sentences[current.sentence].en}
                  </span>
                  <span lang="zh-Hant" className="block text-ink-muted">
                    {video.sentences[current.sentence].zh}
                  </span>
                </p>
              )}
            </div>
          )}
          <PracticeActions
            primary={
              step === "choose" ? (
                <Button type="submit" variant="primary" disabled={!choice}>
                  {t("check")}
                </Button>
              ) : (
                <Button variant="primary" arrow onClick={next}>
                  {index === words.length - 1 ? t("seeResult") : t("nextWord")}
                </Button>
              )
            }
          />
        </form>
      )}
      <PracticeActionsSpacer />
    </div>
  );
}

function Result({
  video,
  results,
  saved,
  onRetry,
}: {
  video: PracticeMaterial;
  results: WordResult[];
  saved: "saved" | "signed-out" | "failed" | null;
  onRetry: () => void;
}) {
  const t = useTranslations("quiz");
  const summary = quizSummary(results);
  return (
    <div className="space-y-6">
      <h2 className="font-display text-h2">{t("resultTitle")}</h2>
      <dl className="grid gap-4 split:grid-cols-3" aria-live="polite">
        <div className="rounded-base border border-line p-4">
          <dt className="text-supporting text-ink-muted">
            {t("spelledCount")}
          </dt>
          <dd className="font-display text-h2">
            {summary.spelled} / {summary.total}
          </dd>
        </div>
        <div className="rounded-base border border-line p-4">
          <dt className="text-supporting text-ink-muted">
            {t("translatedCount")}
          </dt>
          <dd className="font-display text-h2">
            {summary.translated} / {summary.total}
          </dd>
        </div>
        <div className="rounded-base border border-line p-4">
          <dt className="text-supporting text-ink-muted">{t("hintsCount")}</dt>
          <dd className="font-display text-h2">{summary.hints}</dd>
        </div>
      </dl>
      <ul className="divide-y divide-line border-y border-line">
        {results.map((r) => (
          <li
            key={r.word}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2"
          >
            <span lang="en" className="font-medium">
              {r.word}
            </span>
            <span className={r.spelled ? "text-success" : "text-error"}>
              {r.spelled ? t("spellOk") : t("spellMissed")}
            </span>
            <span className={r.translated ? "text-success" : "text-error"}>
              {r.translated ? t("meaningOk") : t("meaningMissed")}
            </span>
            {r.hints > 0 && (
              <span className="text-supporting text-ink-muted">
                {t("usedHints", { count: r.hints })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {summary.missed.length > 0 && (
        <p className="max-w-reading">
          {t("toReview", { count: summary.missed.length })}
        </p>
      )}
      {saved === "signed-out" && (
        <p className="text-supporting text-ink-muted">{t("signInToKeep")}</p>
      )}
      {saved === "failed" && (
        <p role="alert" className="text-supporting text-error">
          {t("saveFailed")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={onRetry}>
          {t("retry")}
        </Button>
        <ButtonLink href={`/videos/${video.id}/listen`} variant="secondary">
          {t("listen")}
        </ButtonLink>
        <ButtonLink href={`/videos/${video.id}`} variant="ghost">
          {t("backToVideo")}
        </ButtonLink>
      </div>
    </div>
  );
}
