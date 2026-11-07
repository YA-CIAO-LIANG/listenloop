import { readFileSync } from "node:fs";

/**
 * Two paragraphs of English news with curly apostrophes and a blank line
 * between them: the text that once showed "no sentences found" on the
 * production site (D49).
 */
export const NEWS_TEXT = readFileSync(
  "tests/fixtures/text/news-two-paragraphs.txt",
  "utf8",
);

export const NEWS_SENTENCES = [
  "In the aftermath of the Republican Party’s sweeping defeat in Tuesday’s midterm elections, Donald Trump said he would be willing to work with the newly ascendent Democrats in Congress.",
  "On Friday, however, he elevated Stephen Miller, his bare-knuckled political operative and longtime adviser, to replace Susie Wiles as White House chief of staff.",
];
