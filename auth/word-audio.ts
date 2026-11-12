import { getBatchCreator } from "./creator";
import { getPracticeMaterial } from "./practice-material";
import { customPracticeId } from "@/lib/practice-material";
import { pickQuizWords, quizCandidates } from "@/lib/vocab-quiz";
import { wordAudio, wordVoice } from "@/lib/word-audio";

/**
 * When an official material is published (D136): its quiz words' audio
 * made ahead, so learners don't wait (Azure F0, the admin's batch
 * allowance). Best effort: stops at the first problem; the rest are made
 * at the first quiz.
 */
export async function pregenerateWordAudio(practiceId: string) {
  const maker = await getBatchCreator();
  const material = await getPracticeMaterial(customPracticeId(practiceId));
  if (!maker || !material) return { made: 0 };
  const voice = wordVoice(material);
  let made = 0;
  for (const word of pickQuizWords(quizCandidates(material), new Set())) {
    const result = await wordAudio(
      { store: maker.store, speech: maker.providers.speech, maker },
      voice,
      word.word,
    );
    if (!result.ok) break;
    made++;
  }
  return { made };
}
