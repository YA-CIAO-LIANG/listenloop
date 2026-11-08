import { EB_Garamond, Instrument_Sans } from "next/font/google";

// Display: serif, regular weight only (see docs/design-system.md).
const ebGaramond = EB_Garamond({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-eb-garamond",
});

// Reading: sans, variable weight for body text and controls.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

// Chinese uses the system's fonts (--ll-cjk-sans and --ll-cjk-serif in
// app/globals.css, D87): no web font download for Chinese.

export const fontVariables = [ebGaramond, instrumentSans]
  .map((font) => font.variable)
  .join(" ");
