/**
 * Renders the app icons and the Play Store feature graphic from
 * brand/icon.svg (D64), with the Chromium Playwright already installs:
 *
 *   node scripts/brand-assets.mts
 *
 * Writes public/icons/*.png, app/icon.svg, app/apple-icon.png, and
 * docs/store/feature-graphic.png. Run again after changing the SVG.
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync("brand/icon.svg", "utf8");
mkdirSync("public/icons", { recursive: true });
mkdirSync("docs/store", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(
  html: string,
  width: number,
  height: number,
  path: string,
) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<html><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden">${html}</body></html>`,
  );
  await page.screenshot({ path, omitBackground: false });
  console.log(path);
}

const icon = (size: number, radius = 0) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>`;

// Full-bleed squares: launchers apply their own mask.
for (const size of [192, 512]) {
  await render(icon(size), size, size, `public/icons/icon-${size}.png`);
  await render(icon(size), size, size, `public/icons/maskable-${size}.png`);
}
// Monochrome (Android 13 themed icons, D178): the loop and dot in white
// on transparent; Android tints it. Same safe zone as the maskable icon.
const monochrome = svg
  .replace(/<rect [^>]*\/>/, "")
  .replaceAll(/(fill|stroke)="#(fafaf8|e8590c)"/g, '$1="#ffffff"');
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(
  `<html><body style="margin:0;background:transparent">${monochrome.replace("<svg ", '<svg width="512" height="512" ')}</body></html>`,
);
await page.screenshot({
  path: "public/icons/monochrome-512.png",
  omitBackground: true,
});
console.log("public/icons/monochrome-512.png");
await render(icon(180), 180, 180, "app/apple-icon.png");
// Play Store icon: 512×512, full square (Play rounds it).
await render(icon(512), 512, 512, "docs/store/play-icon-512.png");

// Feature graphic: 1024×500, the wordmark beside the icon.
await render(
  `<div style="width:1024px;height:500px;background:#fafaf8;display:flex;align-items:center;gap:56px;padding:0 96px;box-sizing:border-box;font-family:Georgia,serif;color:#141414">
     ${icon(220, 48)}
     <div>
       <div style="font-size:84px;line-height:1">ListenLoop</div>
       <div style="font-family:system-ui,sans-serif;font-size:30px;color:#5c5c5c;margin-top:20px">7 天聽力循環 · Hear every word</div>
     </div>
   </div>`,
  1024,
  500,
  "docs/store/feature-graphic.png",
);
await browser.close();

copyFileSync("brand/icon.svg", "app/icon.svg");
console.log("app/icon.svg");
