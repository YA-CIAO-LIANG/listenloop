/**
 * Writes the marketing documents as Word files (D168):
 *
 *   npm run marketing:docx
 *
 * The content is in scripts/marketing/content/ (one module a document);
 * the layout (A4, fonts, headings, table of contents, header and footer)
 * is in scripts/marketing/docx-builder.mts. Writes marketing/word/*.docx
 * and marketing/word/README.md. Run again after changing either.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Packer } from "docx";
import { format } from "prettier";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  buildDocument,
  CJK_FALLBACKS,
  CJK_FONT,
} from "./marketing/docx-builder.mts";
import { documents } from "./marketing/content/index.mts";

const OUT = "marketing/word";
/** The date the content was last checked against the app. */
const DATE = "2026-11-13";

/**
 * docx-js writes no font table, so Word would not know what to use where
 * Microsoft JhengHei is missing (a Mac without Office's fonts). Adds one
 * that names PingFang TC and Noto Sans TC as its alternatives and marks
 * it as a Traditional Chinese (Big5, charset 88) font.
 */
function addFontFallbacks(docx: Uint8Array): Uint8Array {
  const files = unzipSync(docx);
  const ns =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  files["word/fontTable.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:fonts ${ns}>` +
      `<w:font w:name="${CJK_FONT}"><w:altName w:val="${CJK_FALLBACKS.join(",")}"/><w:charset w:val="88"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>` +
      `<w:font w:name="Arial"><w:panose1 w:val="020B0604020202020204"/><w:charset w:val="00"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>` +
      `</w:fonts>`,
  );
  const rels = strFromU8(files["word/_rels/document.xml.rels"]);
  if (!rels.includes("fontTable.xml")) {
    files["word/_rels/document.xml.rels"] = strToU8(
      rels.replace(
        "</Relationships>",
        '<Relationship Id="rIdFontTable" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>',
      ),
    );
  }
  const types = strFromU8(files["[Content_Types].xml"]);
  if (!types.includes("/word/fontTable.xml")) {
    files["[Content_Types].xml"] = strToU8(
      types.replace(
        "</Types>",
        '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/></Types>',
      ),
    );
  }
  // Only files, no folder entries: Word has refused archives with them.
  return zipSync(
    Object.fromEntries(
      Object.entries(files).filter(([name]) => !name.endsWith("/")),
    ),
  );
}

mkdirSync(OUT, { recursive: true });
for (const doc of documents) {
  const buffer = await Packer.toBuffer(buildDocument(doc, DATE));
  const path = `${OUT}/${doc.file}.docx`;
  writeFileSync(path, addFontFallbacks(new Uint8Array(buffer)));
  console.log(path);
}

const readme = [
  "# 行銷素材（Word）",
  "",
  `由 \`npm run marketing:docx\` 產生（D168），請不要直接改這些 .docx：改 \`scripts/marketing/content/\` 的內容再重新產生。內容依 ${DATE} 的功能與方案（\`lib/plans.ts\`、\`docs/quotas.md\`）整理。`,
  "",
  "黃底的〔 〕是待填的欄位（例如創辦人介紹、聯絡方式、上線後的數字），使用前請換成真實資訊；文件裡沒有任何編造的數字或使用者見證。",
  "",
  "| 檔案 | 內容 |",
  "| --- | --- |",
  ...documents.map(
    (doc) =>
      `| [${doc.file}.docx](./${encodeURI(doc.file)}.docx) | ${doc.summary} |`,
  ),
  "",
  "格式：A4、目錄、標題層級、表格、頁首（產品名稱與文件名稱）、頁尾頁碼；中文用微軟正黑體（Mac 上用蘋方或思源黑體替代），英文用 Arial。目錄的頁碼在產生時估算；Word 的字體寬度和估算不同時，在目錄上按右鍵 →「更新功能變數」即可。",
  "",
].join("\n");
writeFileSync(`${OUT}/README.md`, await format(readme, { parser: "markdown" }));
console.log(`${OUT}/README.md`);
