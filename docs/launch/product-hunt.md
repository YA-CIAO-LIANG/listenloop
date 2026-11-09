# Product Hunt launch kit

Drafts for launching ListenLoop on Product Hunt. Everything here is in English (Product Hunt's audience); notes for Joe are in 繁體中文 at the end. Nothing has been posted.

## Name and tagline

- **Name**: ListenLoop
- **Tagline** (60 characters max; pick one):
  1. `Hear every word: one English listening lesson, 7 days` (55)
  2. `A 7-day loop that makes English listening click` (47)
  3. `Dictation + shadowing in a weekly loop you can see` (50)
- **Recommended**: option 1. It says the promise (hear every word) and the method (7 days) without jargon.

## Topics

Education, Language Learning, Productivity, Artificial Intelligence (the creation tools), Web App.

## Description (260 characters max)

> ListenLoop turns one short English clip into a 7-day course: dictate it on Day 1, shadow it on Days 2–6, dictate it again on Day 7 and see exactly how much more you hear. Free official lessons, bilingual notes, and your own AI-made materials.

(247 characters)

## Longer description (for the product page)

**The problem.** Most listening practice is "watch more and hope". You hear a lot, but you can't tell whether you hear _better_ — and the words you miss stay missed.

**The loop.** ListenLoop gives every clip the same 7-day rhythm:

- **Day 1 – Dictation.** Sentence by sentence, type what you hear. Every word is checked, so you see exactly which ones slipped past.
- **Days 2–6 – Shadowing.** Repeat each sentence; speech recognition in your browser shows which words you said.
- **Day 7 – Dictation again.** Same sentences, compared side by side with Day 1. Progress you can see, in percent.

**What's inside**

- Free official lessons: daily life, travel, campus, studying abroad, work, science news rewritten from public-domain releases, and test-style practice (TOEFL, IELTS, TOEIC, GEPT style — original content).
- Notes that adapt to difficulty: highlighted key words, why a phrase is hard to hear (linking, weak forms), grammar, and a bilingual handout you can print as a PDF.
- "My misheard words": every word you miss comes back for a 30-second review 1, 3, and 7 days later.
- Make your own: paste text, let AI write a scenario, or use a Creative Commons YouTube video — split into sentences, translated, annotated, and voiced in US, UK, Australian, or Indian English.
- Classrooms: teachers assign materials and see each student's Day 1 → Day 7 gain.

**Built for** students in Taiwan and Chinese-speaking learners studying abroad, with a Traditional Chinese interface (English too).

**Privacy and cost care.** No recordings are stored; speech recognition runs in the browser. AI is used only when you create a material, with per-day limits, and every sentence's audio and notes are made once and shared.

## First comment (maker's comment) — draft

> Hi Product Hunt! 👋 I'm Joe, a student in Taiwan, and I built ListenLoop with Claude Code as my pair programmer.
>
> I kept "practicing listening" by watching videos and still couldn't follow real conversations. What finally worked was boring and specific: take one short clip, write down every word, repeat it for a week, and check again. ListenLoop is that routine, made easy:
>
> 1. **Day 1**: dictate the clip sentence by sentence, every word checked;
> 2. **Days 2–6**: shadow it — the browser listens and shows which words you said;
> 3. **Day 7**: dictate it again and compare with Day 1.
>
> The words you miss come back as tiny reviews 1, 3, and 7 days later, so they stop being blind spots.
>
> Everything in the official library is free. Paid plans (coming soon) are for making lots of your own materials with AI and for practicing materials other learners share.
>
> I'd love feedback on two things: **Is the 7-day rhythm motivating or too strict?** and **Which materials should we add next?** I'll be here all day answering. Thank you for trying it!

## Screenshot list

Product Hunt gallery: 1270 × 760 px recommended (16:10), up to 8 images; first image is the thumbnail on the launch page. Use the live site in English, light mode, with a signed-in demo account that has real progress.

| #   | What                                         | Page                          | Notes                                                  |
| --- | -------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| 1   | Hero: the 7-day loop with Day 1 → Day 7 gain | `/` (signed in) + week result | Overlay text: "Hear every word in 7 days"              |
| 2   | Day 1 dictation with word-by-word feedback   | `/videos/<official>/day/1`    | One sentence answered with a misheard word highlighted |
| 3   | Notes for a hard sentence                    | same, after answering         | Structure, linking ("want to → wanna"), vocabulary     |
| 4   | Shadowing with recognized words              | `/videos/<official>/day/3`    | Coverage meter at ~80%                                 |
| 5   | Day 7 result vs Day 1                        | week result                   | e.g. 62% → 88%                                         |
| 6   | Official library with filters                | `/` library                   | Categories chosen, length filter                       |
| 7   | Create with AI                               | `/materials/new` (AI writing) | Category, scenario, level, accent                      |
| 8   | Progress share card                          | Day 7 "Share"                 | The generated image                                    |

Also: a 30–60 second demo video (Loom or screen recording) of Day 1 → notes → Day 7 comparison; a 240 × 240 px thumbnail from `brand/icon.svg` (export at 240 × 240).

## Launch checklist

- [ ] Google OAuth published (out of "testing"), so anyone can sign in.
- [ ] Email sign-in: custom SMTP set up (Resend) so confirmation emails arrive.
- [ ] Demo account with progress for the screenshots.
- [ ] Screenshots and demo video in English.
- [ ] Product Hunt maker account; schedule for 00:01 Pacific Time on a Tuesday–Thursday.
- [ ] Prepare replies for common questions: pricing, data privacy, which browsers support shadowing (Chrome), mobile (PWA).
- [ ] Share in communities after launch (Taiwanese student groups, language-learning subreddits), following each community's rules.

## 給 Joe 的備註

- 以上全部是草稿，沒有發布任何內容。首則留言用了「Joe、台灣學生」，請改成你想公開的身分說法。
- 上線前最重要的兩件事：Google OAuth 從「測試」改成「正式」，以及設定寄信用的 SMTP；否則 Product Hunt 來的人無法登入或收不到確認信。
- 截圖第 8 張（進步分享卡）在「進步分享卡」功能上線後拍。
