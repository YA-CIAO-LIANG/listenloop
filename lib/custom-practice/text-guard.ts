/**
 * Whether pasted or uploaded "text" is really text (D159), checked on
 * the server too, since a request can carry anything: no NUL bytes,
 * hardly any control characters, and not mostly undecodable bytes (a
 * binary file read as UTF-8 turns into U+FFFD replacement characters).
 */
export function looksLikeText(text: string): boolean {
  if (text.includes("\u0000")) return false;
  const chars = [...text];
  if (chars.length === 0) return true;
  let control = 0;
  let replaced = 0;
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code < 0x20 && ch !== "\n" && ch !== "\r" && ch !== "\t") ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      control += 1;
    }
    if (code === 0xfffd) replaced += 1;
  }
  return control / chars.length < 0.01 && replaced / chars.length < 0.05;
}
