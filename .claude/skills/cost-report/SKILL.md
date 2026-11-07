---
name: cost-report
description: Report ListenLoop's paid-API usage for this week and the cost of each material — tokens, characters, estimated US$ by provider and operation, Azure credit left, F0 speech characters this month — read from the api_calls log. Use when Joe asks 「本週用量」「花了多少」「每份教材多少錢」「cost report」.
---

# Cost report

Read-only: it reads the usage log (`api_calls`) with the secret key from `.env.local`. It never calls a paid API. Report in 繁體中文, with US$ to 4 decimals.

## Run

```sh
node --env-file=.env.local scripts/cost-report.mts          # this week (last 7 Taiwan days)
node --env-file=.env.local scripts/cost-report.mts 30       # the last 30 days
```

It prints:

1. **Totals for the period**, per operation (compose, segment, translate, annotate, speech): calls, input and output tokens, characters, estimated cost, and failures.
2. **This month**: the cost, Azure for Students credit left (US$100, ends 2027-11-04), and Azure Speech characters out of F0's 500,000.
3. **Per material** (approximate): each practice made in the period with its calls, tokens, characters, and cost. The log has no practice id, so calls are matched by owner and time: writing, splitting, and translating (before saving) go to the owner's next practice; notes and audio (after saving) to the latest one before them. A batch script that makes notes before saving (official drafts) shifts its notes to the previous practice; its own run report is exact.

## Notes

- Prices are in `lib/ai/pricing.ts` (checked 2026-11-05); costs are estimates from token counts, and Azure's bill is the final word.
- If a number looks wrong, compare with `/admin/usage`, which reads the same log.
