# ListenLoop

A 7-day loop English listening practice app: dictation on Day 1, shadowing on Days 2–6, and a re-dictation on Day 7 to show visible progress.

Built with Next.js (App Router), TypeScript, and Tailwind CSS.

**Live:** https://listenloop-three.vercel.app

## Getting started

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Production build                 |
| `npm run lint`         | ESLint                           |
| `npm run format`       | Format all files with Prettier   |
| `npm run format:check` | Check formatting without writing |
| `npm run typecheck`    | TypeScript type check            |
| `npm test`             | Run unit tests once (Vitest)     |
| `npm run test:watch`   | Run unit tests in watch mode     |

## Contributing

- Work on a branch named `feat/…`, `fix/…`, or `chore/…`; never commit to `main` directly.
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat: add dictation scoring`).
- A pre-commit hook runs ESLint and Prettier on staged files.
- CI runs lint, format check, type check, tests, and build on every pull request.
