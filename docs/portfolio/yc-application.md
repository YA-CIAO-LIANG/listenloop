# YC-style application draft (ListenLoop)

> A short draft in the style of Y Combinator's application. Joe: fill in the bracketed parts (names, background, contact) and check the numbers before sending.

## Describe what your company does in 50 characters or less

English listening practice you can see improving. (49)

## What is your company going to make?

ListenLoop is a web app (PWA) that turns one 1–3 minute English clip into a 7-day course. Day 1: dictate it sentence by sentence, with every word checked. Days 2–6: shadow it with in-browser speech recognition. Day 7: dictate it again and compare with Day 1. Learners see exactly which words they miss and how much better they hear after a week; missed words come back as spaced reviews. A free official library covers daily life, campus, study abroad, work, news, and exam-style listening; paid users make their own lessons from any text, an AI-written scenario, or a Creative Commons video, and teachers run classes.

## Why did you pick this idea? What do you understand about it that others don't?

[Joe's personal story here.] Most listening products give more content (shows, podcasts, AI chat). The bottleneck for intermediate learners isn't content, it's _certainty_: they understand the gist but can't tell whether they heard every word, so they can't see progress and quit. Dictation and shadowing are proven but tedious to run by hand; we make them a paced routine with a measurable result.

## The problem

Students in Taiwan spend years on English, and listening is where they feel least sure. "Listen more" gives no feedback; the same linked and weak-form words stay missed.

## The solution

A fixed weekly loop with word-level feedback, a Day 1 vs Day 7 score, and handouts that explain _why_ a phrase is hard to hear (linking, weak forms, sentence chunks).

## Why now?

- Language models make bilingual notes, translations, and natural voices for any text affordable: about US$0.01–0.05 per lesson, made once and shared.
- Browsers now do speech recognition on the device, so shadowing feedback is free and private.
- Studying abroad and English-taught programs keep growing in Taiwan and across Asia, and these learners need everyday listening, not just exam drills.

## Market

- Taiwan: about 1.1 million university and graduate students and about 0.6 million senior high students (Ministry of Education statistics; verify the latest year), plus working adults preparing for TOEIC and the GEPT.
- Beyond Taiwan: Chinese-speaking learners and students abroad; the same loop works for any language pair with new notes.
- [Add a bottom-up estimate: e.g., X% of students paying NT$Y a month.]

## Competitors and how we're different

|                                         | What they do             | How ListenLoop differs                                                    |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| YouTube / podcasts                      | Endless content          | A fixed loop with word-level feedback and a measured result               |
| Duolingo and gamified apps              | Short exercises, streaks | Real clips, full-sentence dictation, progress as a percentage, not points |
| Exam prep (TOEIC, IELTS books and apps) | Question banks           | Trains hearing every word, which question banks assume                    |
| AI tutors and chat apps                 | Conversation practice    | Listening accuracy, with handouts that explain linking and weak forms     |
| Cram schools                            | Teacher-led classes      | A class plan teachers can use to assign and track                         |

## Progress so far

- Built in 20 days by [Joe] (product owner) with Claude Code as the engineering partner; live at https://listenloop-three.vercel.app.
- 51 official lessons published; bilingual UI; classroom tools; PWA with offline audio.
- Quality: ~1,570 unit tests, 96 end-to-end tests, 22 rounds of page-by-page QA, Lighthouse mobile 92 / accessibility 100.
- Total real AI spend for the whole build: about US$2.
- Users and retention: [fill in from /admin and /admin/retention before sending].

## Business model

Freemium. All official lessons are free. Paid plans (Plus and Pro) for making your own lessons with AI and for practicing lessons other learners share; class plans for teachers and schools. Prices are being tested with a fake door (pricing page → plan → subscribe → waiting list); no one is charged yet. Unit cost per lesson is cents because AI runs only at creation and results are cached.

## Founders

- [Name], product owner: [background, why you, how you met the problem].

## Contact

[email]
