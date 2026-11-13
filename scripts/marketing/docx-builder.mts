/**
 * Turns the marketing documents (scripts/marketing/content/*.mts) into
 * Word files (D168): A4, a title page, a table of contents, headings,
 * tables, a header with the product name, and page numbers.
 *
 * Fonts: Traditional Chinese text uses Microsoft JhengHei (Windows), with
 * PingFang TC (macOS) and Noto Sans TC as the fallbacks Word is told
 * about in the font table; Latin text is Arial everywhere, so both scripts
 * look the same in every heading, paragraph, and table.
 *
 * Inline marks in any text: **bold**, and 〔placeholder〕, which is
 * highlighted yellow so nobody sends a placeholder by mistake.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HighlightColor,
  LevelFormat,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ParagraphChild } from "docx";
import { estimatePageNumbersWith } from "docx/layout";

/** A block of a marketing document. */
export type Block =
  | { h1: string }
  | { h2: string }
  | { h3: string }
  | { p: string }
  | { bullets: readonly string[] }
  | { steps: readonly string[] }
  /** Text to copy as it is (a post, a letter): a shaded box. Lines are paragraphs. */
  | { copy: string }
  /** A notice for Joe (what to fill in, what to check): an orange rule on the left. */
  | { note: string }
  | {
      table: {
        /** Header and relative width of each column. */
        columns: readonly (readonly [string, number])[];
        /** Cells; "\n" starts a new paragraph inside a cell. */
        rows: readonly (readonly string[])[];
      };
    }
  | { pageBreak: true };

export type MarketingDoc = {
  /** File name in marketing/word/, without .docx. */
  file: string;
  title: string;
  subtitle: string;
  /** One line for marketing/word/README.md. */
  summary: string;
  blocks: readonly Block[];
};

// Brand colours (docs/design-system.md, light mode).
const INK = "141414";
const MUTED = "5C5C5C";
const ACCENT = "E8590C";
const ACCENT_INK = "A63D09";
const LINE = "E5E3DE";
const BAND = "F2F1ED";

export const LATIN_FONT = "Arial";
export const CJK_FONT = "Microsoft JhengHei";
/** Told to Word as the alternatives of CJK_FONT (see addFontFallbacks). */
export const CJK_FALLBACKS = ["PingFang TC", "Noto Sans TC"];

const FONT = {
  ascii: LATIN_FONT,
  hAnsi: LATIN_FONT,
  cs: LATIN_FONT,
  eastAsia: CJK_FONT,
};
const LANGUAGE = { value: "en-US", eastAsia: "zh-TW" };

// A4 with 2 cm margins: the text is 210 − 40 = 170 mm wide.
const MARGIN = 1134;
const TEXT_WIDTH = 11906 - 2 * MARGIN;

/** Splits **bold**, `code`, and 〔placeholder〕 marks into runs. */
export function inline(
  text: string,
  base: { bold?: boolean; color?: string } = {},
) {
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|〔[^〕]*〕)/g;
  for (const part of text.split(pattern)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), ...base, bold: true }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          ...base,
          font: { ...FONT, ascii: "Consolas", hAnsi: "Consolas" },
          color: ACCENT_INK,
        }),
      );
    } else if (part.startsWith("〔")) {
      runs.push(
        new TextRun({ text: part, ...base, highlight: HighlightColor.YELLOW }),
      );
    } else {
      runs.push(new TextRun({ text: part, ...base }));
    }
  }
  return runs;
}

const lines = (text: string) => text.split("\n");

function cellParagraphs(text: string, header: boolean) {
  return lines(text).map(
    (line) =>
      new Paragraph({
        spacing: { before: 40, after: 40, line: 300 },
        children: inline(line, header ? { bold: true } : {}),
      }),
  );
}

function table(spec: Extract<Block, { table: unknown }>["table"]) {
  const total = spec.columns.reduce((sum, [, weight]) => sum + weight, 0);
  const widths = spec.columns.map(([, weight]) =>
    Math.floor((TEXT_WIDTH * weight) / total),
  );
  widths[widths.length - 1] += TEXT_WIDTH - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
  const row = (cells: readonly string[], header: boolean) =>
    new TableRow({
      tableHeader: header,
      // Rows are short: keeping each on one page reads better, and lets
      // the page estimate below follow the layout exactly.
      cantSplit: true,
      children: cells.map(
        (text, i) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            shading: header
              ? { type: ShadingType.CLEAR, color: "auto", fill: BAND }
              : undefined,
            children: cellParagraphs(text, header),
          }),
      ),
    });
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: [
      row(
        spec.columns.map(([name]) => name),
        true,
      ),
      ...spec.rows.map((cells) => row(cells, false)),
    ],
  });
}

function render(block: Block): (Paragraph | Table)[] {
  if ("h1" in block)
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: inline(block.h1),
      }),
    ];
  if ("h2" in block)
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: inline(block.h2),
      }),
    ];
  if ("h3" in block)
    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: inline(block.h3),
      }),
    ];
  if ("p" in block)
    return lines(block.p).map(
      (line) => new Paragraph({ children: inline(line) }),
    );
  if ("bullets" in block)
    return block.bullets.map(
      (item) =>
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 60 },
          children: inline(item),
        }),
    );
  if ("steps" in block) {
    // Each list restarts at 1: a new numbering instance per list.
    const instance = ++stepLists;
    return block.steps.map(
      (item) =>
        new Paragraph({
          numbering: { reference: "steps", level: 0, instance },
          spacing: { after: 60 },
          children: inline(item),
        }),
    );
  }
  if ("copy" in block) {
    const all = lines(block.copy);
    return all.map(
      (line, i) =>
        new Paragraph({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: BAND },
          indent: { left: 170, right: 170 },
          spacing: {
            before: i === 0 ? 120 : 0,
            after: i === all.length - 1 ? 200 : 0,
            line: 320,
          },
          border:
            i === 0
              ? {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: LINE,
                    space: 6,
                  },
                }
              : i === all.length - 1
                ? {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 4,
                      color: LINE,
                      space: 6,
                    },
                  }
                : undefined,
          children: line ? inline(line) : [new TextRun("")],
        }),
    );
  }
  if ("note" in block)
    return lines(block.note).map(
      (line) =>
        new Paragraph({
          indent: { left: 200 },
          spacing: { before: 60, after: 60 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 18,
              color: ACCENT,
              space: 8,
            },
          },
          children: inline(line, { color: MUTED }),
        }),
    );
  if ("table" in block)
    return [table(block.table), new Paragraph({ children: [] })];
  return [new Paragraph({ children: [new PageBreak()] })];
}

let stepLists = 0;

const heading = (size: number, before: number, after: number) => ({
  run: { font: FONT, size, bold: true, color: INK },
  paragraph: { spacing: { before, after }, keepNext: true, keepLines: true },
});

export function buildDocument(doc: MarketingDoc, date: string) {
  stepLists = 0;
  const cover: Paragraph[] = [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      children: [
        new TextRun({
          text: "ListenLoop",
          color: ACCENT_INK,
          bold: true,
          size: 28,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: ACCENT,
          space: 8,
        },
      },
      children: [
        new TextRun({ text: doc.title, size: 56, bold: true, color: INK }),
      ],
    }),
    new Paragraph({ children: inline(doc.subtitle, { color: MUTED }) }),
    new Paragraph({
      spacing: { before: 480 },
      children: [new TextRun({ text: `版本日期：${date}`, color: MUTED })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "網站：https://listenloop-three.vercel.app",
          color: MUTED,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 240 },
      children: inline("黃底的〔 〕是待填的欄位，使用前請換成真實資訊。", {
        color: MUTED,
      }),
    }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: "目錄", size: 32, bold: true, color: INK }),
      ],
    }),
  ];
  const body = doc.blocks.flatMap(render);

  return new Document({
    creator: "ListenLoop",
    // Writes the table of contents' page numbers with the file, so Word
    // shows them without asking to update fields. Microsoft JhengHei isn't
    // in docx's width tables, so its widths are a close guess: Word's
    // "Update field" makes them exact.
    pageNumbers: estimatePageNumbersWith({ guess: true }),
    title: `ListenLoop ${doc.title}`,
    description: doc.summary,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 21, color: INK, language: LANGUAGE },
          paragraph: { spacing: { after: 120, line: 330 } },
        },
        title: heading(56, 0, 240),
        heading1: heading(32, 360, 160),
        heading2: heading(26, 280, 120),
        heading3: heading(22, 200, 80),
      },
      paragraphStyles: [1, 2, 3].map((level) => ({
        id: `TOC${level}`,
        name: `toc ${level}`,
        basedOn: "Normal",
        next: "Normal",
        run: { font: FONT, size: 21, bold: level === 1 },
        paragraph: {
          indent: { left: (level - 1) * 360 },
          spacing: { after: 60 },
        },
      })),
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 400, hanging: 260 } } },
            },
          ],
        },
        {
          reference: "steps",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 300 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
              header: 567,
              footer: 567,
            },
          },
          titlePage: true,
        },
        headers: {
          first: new Header({ children: [new Paragraph({ children: [] })] }),
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: LINE,
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: "ListenLoop",
                    bold: true,
                    color: ACCENT_INK,
                    size: 18,
                  }),
                  new TextRun({
                    text: `｜${doc.title}`,
                    color: MUTED,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({ children: [new Paragraph({ children: [] })] }),
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [
                      "第 ",
                      PageNumber.CURRENT,
                      " 頁，共 ",
                      PageNumber.TOTAL_PAGES,
                      " 頁",
                    ],
                    color: MUTED,
                    size: 18,
                  }),
                ] as ParagraphChild[],
              }),
            ],
          }),
        },
        children: [
          ...cover,
          new TableOfContents("目錄", {
            hyperlink: true,
            headingStyleRange: "1-2",
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...body,
        ],
      },
    ],
  });
}
