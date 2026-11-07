---
name: add-video
description: Add a built-in video to ListenLoop's library from its subtitles (an official .srt, or a YouTube transcript Joe copied) — verify the license, make the draft JSON with `npm run video:new`, write the Chinese, vocabulary, and grammar, and prepare it for timing. Use when Joe gives a video and its subtitles, or says 「新增影片」「加一支影片」.
---

# Add a video from its subtitles

The full rules are in `docs/content-workflow.md` and CLAUDE.md「資料格式」; follow them, this is the checklist. Talk to Joe in 繁體中文.

## 1. Check before any work

- License on the **official page**: CC BY, CC BY-SA, or Public Domain only (no NC, ND; no AP, Reuters, AFP). Record the URL and the required credit in `docs/video-candidates.md`.
- The YouTube uploader is the rights holder's official channel (channel ID), and the video can be embedded (oEmbed).
- The subtitles match **this** YouTube video: an official `.srt` of the same length, or the video's own captions (not auto-generated). Never a transcript web page.

If any check fails, stop and tell Joe why.

## 2. Make the draft

1. Write `meta.json`: `id` (lowercase, hyphens; never starting with `p-`), `youtubeId`, `title`, `level`, `category`, `collection` (an id in `lib/videos.ts` `videoCollections`), `source`, `attribution` (credit, license, licenseUrl, sourceUrl, transcriptUrl, changes), and `cues` (`from`, `to`, optional `skip`, `merge`).
2. Run one of:
   ```sh
   npm run video:new -- meta.json subtitles.srt
   npm run video:new -- meta.json transcript.txt   # YouTube transcript Joe copied
   ```
   It writes `data/videos/<id>.json` with `"draft": true` and registers it in `data/videos/index.ts`. A merge across a pause longer than 2 seconds is refused: split it instead.
3. For one film cut into parts: make the full version first, then each part with `"excerptOf"`, and `npm run video:sync`.

## 3. Write the content (no AI calls at run time)

- Chinese for every sentence: natural Taiwanese usage, by meaning.
- 8–12 vocabulary items and 3–4 grammar points, each with `sentence` (the source sentence's index) and a new simple example.
- Note on-screen text or leading "..." you tidied in `attribution.changes`.

## 4. Hand over for timing

- Run the five checks (`npm run lint`, `format:check`, `typecheck`, `test`, `build`).
- Open a PR on a `content/<id>` branch listing every sentence, translation, word, and grammar point for Joe to review.
- Ask Joe to time it at `/videos/<id>/timing` (tap mode, then fine-tune) and paste the JSON back. Then paste the times in, remove `draft`, check again, and merge only when Joe says 「合併」.
