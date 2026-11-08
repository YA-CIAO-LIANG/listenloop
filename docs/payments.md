# 金流準備（D85）

> 狀態：程式只接了**假的供應者**（`PAYMENTS_PROVIDER=fake`），正式站不會出現結帳按鈕，定價頁顯示「即將推出」與等候名單。真的收錢之前，要先完成本文最後的「上線前要做的事」。
>
> 這份比較寫於 2026-11-09，費率與條件會變，申請前請以各家官方頁面為準。本文不是法律或稅務建議。

## 情況

- Joe 是在美國讀書的台灣學生，以**個人**身分經營，沒有公司。
- 使用者大多是台灣學生，賣的是**數位訂閱**（每月或每年）。
- 先上線網頁版，之後用 PWA 包成 Android App 上 Google Play。

## 五種選擇比較

|                    | Lemon Squeezy                                                       | Paddle                         | Stripe（直接）                                                                   | 綠界／藍新                                     | Google Play 帳款服務                    |
| ------------------ | ------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| **角色**           | 代理商（Merchant of Record，MoR）：它是法律上的賣家，代收代繳各國稅 | 代理商（MoR）                  | 只是金流，你是賣家，要自己處理稅                                                 | 台灣的金流，你是賣家                           | Google 是 MoR                           |
| **個人可以申請嗎** | 可以，不用公司                                                      | 視情況，要問客服               | 帳戶要開在你有身分的國家；在美國需要 SSN／EIN 和美國銀行帳戶，台灣帳戶有撥款限制 | 可以用台灣身分證申請個人會員，需要台灣銀行帳戶 | 可以（Play 開發者帳號，個人需身分驗證） |
| **手續費（約）**   | 5% + US$0.50；國際撥款另收約 1%                                     | 5% + US$0.50；小額訂單要談     | 2.9% + US$0.30，再加稅務工具，合計約 4～5%                                       | 信用卡約 2.5～3%，超商、ATM 另計               | 訂閱的服務費加帳款費合計約 15%          |
| **撥款到台灣**     | 銀行或 PayPal                                                       | 有台灣開發者回報可以，但要確認 | 不方便                                                                           | 直接撥到台灣帳戶                               | 可以                                    |
| **稅務**           | 它代收代繳各國的 VAT、銷售稅                                        | 同左                           | 你自己處理（美國各州、歐盟 VAT…）                                                | 你自己在台灣申報                               | Google 代收代繳                         |
| **付款方式**       | 國際信用卡、PayPal、Apple Pay                                       | 同左                           | 信用卡等                                                                         | 台灣信用卡、超商、ATM、LINE Pay 等             | Google Play 的付款方式                  |
| **適合**           | 網頁版，個人開發者                                                  | 網頁版，量大時                 | 有美國公司後                                                                     | 只賣台灣、在台灣有身分與帳戶                   | **Android App 內購買，政策上必須用**    |

## 建議

1. **網頁版：Lemon Squeezy**（第二選擇 Paddle）。
   - 它是代理商，國際稅務由它處理。個人可以申請，不需要公司，撥款可以到台灣或 PayPal。
   - 費率比 Stripe 高，但省下最難的稅務合規。對個人開發者來說，這是業界最常見的起步方式。
   - 注意：Lemon Squeezy 已被 Stripe 收購，申請前確認它仍接受新的個人賣家。
2. **Android App：Google Play 帳款服務。** 在 Play 上架的 App 內販售數位訂閱，依政策要用 Play 帳款（部分地區可以另外提供其他付款方式）。同一個帳號在網頁和 App 買的訂閱，都會寫進同一個 `subscriptions`，`profiles.plan` 是唯一的判斷依據。
3. **暫不建議**：
   - **Stripe 直接收款**：需要美國公司或身分，還要自己處理各國的稅。
   - **綠界、藍新**：需要台灣身分與銀行帳戶，並在台灣申報所得；如果之後主要在台灣經營，可以再評估，好處是手續費低，也能用超商、ATM 付款。

## ⚠️ 收錢之前，先問國際學生辦公室

- **簽證**：以 F-1 等學生簽證在美國時，經營事業並收取收入，可能被視為未經許可的工作（self-employment），影響身分。真的收錢之前，請先問學校的國際學生辦公室（DSO）。
- **稅務**：問清楚美國和台灣兩邊的報稅方式，必要時請教熟悉跨國稅務的會計師。
- **Stripe Atlas 等公司方案**：外國人持有的美國 LLC 每年要申報 IRS 表格 5472，漏報的罰款從 US$25,000 起。

## 程式架構（已完成，只有假的供應者）

| 部分       | 位置                                              | 說明                                                                                                    |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 價格       | `lib/payments/pricing.ts`                         | 月繳、年繳的價格集中在這裡；年繳等於 10 個月                                                            |
| 供應者介面 | `lib/payments/types.ts`                           | `createCheckout`、`parseWebhook`（驗章）、`setCancelAtPeriodEnd`、`refund`                              |
| 假的供應者 | `lib/payments/fake.ts`                            | 不碰錢、不連網路；結帳頁是 `/checkout/fake`；每個變化都以**簽章過的 webhook** 送到同一個處理程式        |
| 選擇供應者 | `auth/payments.ts` 的 `getPaymentProvider`        | 用 `PAYMENTS_PROVIDER` 和 `PAYMENTS_WEBHOOK_SECRET` 決定；正式站（`VERCEL_ENV=production`）永遠不用假的 |
| Webhook    | `app/payments/webhook/route.ts`                   | 驗證 HMAC-SHA256 簽章與時間（5 分鐘內，防重放），再套用事件                                             |
| 套用事件   | `lib/payments/apply.ts`                           | 同一個事件 ID 只套用一次（`payment_events`）；舊的訂閱事件不會蓋掉新的；失敗會釋放，讓供應者重試        |
| 資料表     | `supabase/migrations/20261109010000_payments.sql` | `subscriptions`、`payments`（本人可讀）、`payment_events`（只有伺服器）                                 |

`profiles.plan` 跟著訂閱走：訂閱有效或扣款失敗重試中（past_due）是付費，到期後變免費。降級時教材全部保留，只是不能再新增（`PLANS.free`）。

### 接上真的供應者時

1. 在 `lib/payments/` 新增一個檔案，實作 `PaymentProvider`：
   - 把它的 webhook 轉成 `PaymentEvent`；
   - 驗章用它自己的方式，例如 Lemon Squeezy 的 `X-Signature` 是 HMAC-SHA256。
2. 在 `getPaymentProvider` 加上它的名字。
3. Vercel 環境變數：
   - `PAYMENTS_PROVIDER`；
   - `PAYMENTS_WEBHOOK_SECRET`；
   - 它的 API 金鑰，只放環境變數。
4. 在供應者後台把 webhook 設成 `https://<網域>/payments/webhook`。
5. 先在它的測試模式走一次：結帳、續訂、取消、退款、到期，確認 `/admin/revenue` 的數字正確。

## 上線前要做的事（需要 Joe）

1. 問國際學生辦公室：簽證身分是否允許這筆收入（見上方）。
2. 選定供應商並申請帳號：需要身分驗證和撥款帳戶，**可能需要信用卡或銀行資料，要 Joe 本人同意**。
3. 確定價格：目前是暫定的 NT$149／月、NT$1,490／年，改 `lib/payments/pricing.ts` 即可。
4. 請律師或熟悉的人看過：
   - 服務條款的訂閱條款；
   - 退款政策（`/refund`）；
   - 隱私權政策的付款資料段落。
5. 告訴 Claude 選了哪一家，Claude 再實作那一家的供應者，並在它的測試模式完整測一次。

## 參考資料

- [Taiwan Indie Developer Global Payments Guide 2026](https://www.shareuhack.com/en/posts/taiwan-indie-dev-global-payments-guide-2026)
- [Lemon Squeezy：Supported Countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)、[Getting paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)
- [Paddle pricing](https://paddle.com/pricing)
- [What Google Play's new billing rules mean for subscriptions](https://adapty.io/blog/google-play-billing-changes-subscriptions-fees)
