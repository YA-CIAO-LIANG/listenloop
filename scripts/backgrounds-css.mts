/**
 * Writes app/backgrounds.css from lib/backgrounds.ts (D121). Run after
 * changing a background; tests/backgrounds.test.ts fails if they differ.
 *
 *   npm run backgrounds:css
 */
import { writeFileSync } from "node:fs";
import { backgroundCss } from "../lib/backgrounds.ts";

writeFileSync("app/backgrounds.css", backgroundCss());
console.log("wrote app/backgrounds.css");
