/** English words in an essay, as people count them (D187). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}
