# Email 範本：等候名單開放通知、歡迎信

> 寄信服務（SMTP，例如 Resend）設定好之後才能寄（見 `docs/roadmap.md`「需要 Joe 操作的事」）。
> 等候名單可在後台「付費意願」下載 CSV（`/admin/waitlist/export`）。
> 價格以 `lib/payments/pricing.ts` 為準（目前 Plus NT$149／月、Pro NT$319／月）；早鳥優惠的數字是**建議**，開放前由 Joe 決定。
> 介面有中英文，信件也準備中英文；依帳號的介面語言寄送。

---

## 1. 等候名單：付費方案開放通知（早鳥）

### 中文

**主旨**：ListenLoop 付費方案開放了——等候名單早鳥價 7 天內有效

**預覽文字**：謝謝你一直在等。前 7 天，Plus 年繳享早鳥優惠。

> 〔名字或「你好」〕：
>
> 謝謝你加入 ListenLoop 的等候名單。付費方案今天開放了！
>
> **等候名單專屬早鳥優惠（〔日期〕前有效）**
>
> - Plus 年繳：〔原價〕→〔早鳥價〕（建議：首年 7 折）
> - Pro 年繳：〔原價〕→〔早鳥價〕
>
> **付費方案可以做什麼**
>
> - 每月建立更多自己的教材：貼上文章、讓 AI 寫情境，或用 CC 授權的 YouTube 影片；
> - 完整練習其他學習者分享的公開教材；
> - 播放速度 0.75×／1.25×、完整的學習分析、自訂通關條件。
>
> 官方教材和 7 天循環的練習一直都是免費的，不會因為付費方案而改變。
>
> 〔按鈕：用早鳥價開始 →〕（連到 `/pricing?from=waitlist-email`）
>
> 有任何問題，直接回覆這封信就好。
>
> ListenLoop 團隊
>
> ---
>
> 你收到這封信，是因為你在 ListenLoop 加入了付費方案的等候名單。〔取消訂閱連結〕
> 退款政策：https://listenloop-three.vercel.app/refund

### English

**Subject**: ListenLoop's paid plans are open: your early-bird price for 7 days

**Preview text**: Thanks for waiting. For the first 7 days, Plus yearly is on early-bird pricing.

> Hi 〔name〕,
>
> Thanks for joining ListenLoop's waiting list. Paid plans are open today!
>
> **Early-bird pricing for the waiting list (until 〔date〕)**
>
> - Plus, yearly: 〔price〕 → 〔early-bird price〕 (suggested: 30% off the first year)
> - Pro, yearly: 〔price〕 → 〔early-bird price〕
>
> **What paid plans add**
>
> - More lessons of your own each month: paste a text, have AI write a scenario, or use a Creative Commons YouTube video;
> - Full practice of lessons other learners share;
> - 0.75× / 1.25× playback, full learning analytics, and your own pass rules.
>
> Official lessons and the 7-day practice stay free.
>
> 〔Button: Start at the early-bird price →〕
>
> Questions? Just reply to this email.
>
> The ListenLoop team
>
> ---
>
> You're getting this because you joined ListenLoop's paid-plan waiting list. 〔Unsubscribe〕

---

## 2. 歡迎信（新使用者註冊後）

### 中文

**主旨**：歡迎來到 ListenLoop：今天先做第 1 天就好

**預覽文字**：7 天後，你會看到自己聽懂了多少。

> 〔名字或「你好」〕，歡迎！
>
> ListenLoop 的練法很簡單：**一段英文，練 7 天。**
>
> 1. **今天（第 1 天）**：選一份教材，一句一句聽寫。錯的字會標出來，並告訴你為什麼難聽懂。
> 2. **第 2～6 天**：每天跟讀，大約 5～10 分鐘。
> 3. **第 7 天**：再聽寫一次，和第 1 天比較。
>
> 不知道從哪裡開始？
>
> - 做 2 分鐘的程度測驗：〔/level-test〕
> - 或直接從「留學生活」「多益風格」等主題挑一份：〔/learn〕
>
> 小提醒：
>
> - 跟讀用 Chrome 最穩；錄音不會上傳。
> - 聽錯的字會在 1、3、7 天後出現在首頁的「錯字複習」。
>
> 〔按鈕：開始第 1 天 →〕
>
> ListenLoop 團隊

### English

**Subject**: Welcome to ListenLoop: just do Day 1 today

**Preview text**: In seven days you'll see how much more you hear.

> Welcome, 〔name〕!
>
> The ListenLoop way is simple: **one clip, seven days.**
>
> 1. **Today (Day 1)**: pick a lesson and dictate it sentence by sentence. Missed words are marked, with why they're hard to hear.
> 2. **Days 2–6**: shadow it, about 5–10 minutes a day.
> 3. **Day 7**: dictate it again and compare with Day 1.
>
> Not sure where to start? Take the 2-minute level test, or pick a topic such as study abroad or TOEIC style.
>
> Tips: shadowing works best in Chrome, and recordings never leave your device. Missed words come back for review 1, 3, and 7 days later.
>
> 〔Button: Start Day 1 →〕
>
> The ListenLoop team

---

## 寄送注意

- 只寄給同意收信的人：等候名單是自己加入的，歡迎信是註冊時的服務通知，都要附取消訂閱（服務通知可以不附，但建議附）。
- 早鳥優惠要寫清楚期限與適用方案，優惠內容要和結帳頁一致。
- 先寄給自己測試：手機與電腦、深色模式、Gmail／Outlook 都看一次。
