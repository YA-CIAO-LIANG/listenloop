/**
 * Theme switches fade (D166): while `change` swaps the theme, scheme, or
 * accent attributes on <html>, `data-theme-switching` turns on a short
 * color transition (app/globals.css), removed again once it has run.
 * Under prefers-reduced-motion the CSS adds no transition, so the switch
 * is instant.
 */
export const THEME_SWITCHING_ATTRIBUTE = "data-theme-switching";

/** Long enough for the transition in app/globals.css (280ms) to finish. */
const SWITCH_MS = 400;

let timer: ReturnType<typeof setTimeout> | undefined;

export function withThemeTransition(change: () => void) {
  if (typeof document === "undefined") return change();
  const root = document.documentElement;
  root.setAttribute(THEME_SWITCHING_ATTRIBUTE, "");
  change();
  clearTimeout(timer);
  timer = setTimeout(
    () => root.removeAttribute(THEME_SWITCHING_ATTRIBUTE),
    SWITCH_MS,
  );
}
