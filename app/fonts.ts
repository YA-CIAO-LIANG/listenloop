import {
  EB_Garamond,
  Instrument_Sans,
  Noto_Sans_TC,
  Noto_Serif_TC,
} from "next/font/google";

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

// CJK fonts have no preloadable Chinese subset; Google serves them in
// unicode-range slices, so only the characters on the page are downloaded.
const notoSerifTC = Noto_Serif_TC({
  weight: "400",
  preload: false,
  display: "swap",
  variable: "--font-noto-serif-tc",
});

const notoSansTC = Noto_Sans_TC({
  preload: false,
  display: "swap",
  variable: "--font-noto-sans-tc",
});

export const fontVariables = [
  ebGaramond,
  instrumentSans,
  notoSerifTC,
  notoSansTC,
]
  .map((font) => font.variable)
  .join(" ");
