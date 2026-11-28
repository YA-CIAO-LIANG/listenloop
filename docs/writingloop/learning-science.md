# WritingLoop 的學習科學依據

WritingLoop 是 ListenLoop 裡的 7 天英文寫作循環，目標使用者是台灣學生。這份文件說明每個設計背後的研究依據、在產品裡怎麼用，以及研究的限制。

撰寫原則：

- 只引用可以查證的文獻。不確定的細節（例如頁碼、DOI）寧可省略，不猜。
- 大部分研究是在實驗室或特定課堂做的，受試者、材料、測驗方式都和 WritingLoop 不同。這些研究能支持「這樣設計是合理的」，不能保證「用了就一定進步多少」。
- 這份文件是內部設計依據。對使用者的文案要遵守文末的「產品文案的規則」。

## 功能與原理對照表

| 功能                                                            | 主要原理                         | 次要原理                     |
| --------------------------------------------------------------- | -------------------------------- | ---------------------------- |
| Day 1 先寫自己的版本，再看範文                                  | 生成效應、預先測試／有效失敗     | 回饋研究                     |
| 範文在送出後才解鎖                                              | 預先測試／有效失敗               | 提取練習                     |
| AI 回饋只標出前 3 個問題＋1～2 個優點                           | 認知負荷、回饋研究（聚焦式回饋） | 刻意練習                     |
| 較小的問題收在「更多建議」                                      | 認知負荷                         | 回饋研究                     |
| Day 2～6 每天聽寫回譯 5～8 句（D195）                           | 提取練習、輸出假說               | 生成效應、分散練習           |
| 聽寫回譯的句子：自己被改過的句子＋範文重點句                    | 刻意練習、輸出假說（注意到落差） | 間隔重複                     |
| 「更多練習」：7 種練習由學習者自己選                            | 刻意練習                         | 自主性                       |
| 改自己的錯句（先自己改，再看答案）                              | 生成效應、提取練習               | 回饋研究                     |
| 句型模仿、句子合併、改寫（paraphrase）                          | 刻意練習、生成效應               | 寫作教學研究（句子合併）     |
| 段落重組（連貫與轉折詞）                                        | 生成效應                         | 刻意練習                     |
| 讀 30 秒、蓋住、憑記憶重寫                                      | 提取練習                         | 生成效應                     |
| 聽 ListenLoop 音檔後寫摘要                                      | 提取練習、生成效應               | 與聽力練習連結               |
| 每次練習都立即回饋                                              | 回饋研究                         | 提取練習（回饋加強測驗效果） |
| 錯誤類型混在一起出題                                            | 交錯練習                         | 提取練習                     |
| 錯題本：錯誤與好用句型在 1、3、7 天後再出現                     | 間隔重複                         | 提取練習                     |
| 每天 10～15 分鐘、連續多天                                      | 分散練習、睡眠鞏固               | 認知負荷                     |
| Day 7 不看 Day 1 和範文，重寫同一題、比較分數                   | 提取練習                         | 刻意練習（看得見的進步）     |
| 聽寫回譯送出前選信心度（D202）                                  | 超矯正效應                       | 後設認知                     |
| 提示逐漸減少：首字母＋字數 → 字數 → 無（D202）                  | 鷹架逐漸撤除                     | 專業反轉效應                 |
| 寫錯時先寫「我覺得錯在哪裡」（D202）                            | 自我解釋                         | 生成效應                     |
| 睡前回顧：從記憶寫出今天的 3 個句子（D203）                     | 睡眠鞏固、提取練習               | 分散練習                     |
| 第 30 天延遲重寫，比較第 1、7、30 天（D203）                    | 學習與表現的區別、保留間隔       | 合意難度                     |
| 額外練習的 AI 批改（D200）                                      | 回饋研究                         | 提取練習                     |
| Day 2～6 練習自己文章的正確版本（D218）                         | 自我參照效應、注意差距           | 輸出假說                     |
| Day 2～6 依序聽與看→填空→首字母／中文→看中文寫→默寫段落（D219） | 合意難度、鷹架逐漸撤除           | 提取練習                     |
| 前一天答錯的句子隔天先出現（D219）                              | 間隔重複                         | 超矯正效應                   |

## 1. 生成效應（generation effect）與預先測試

### 原理說明

- **生成效應**：自己產生（generate）的內容，通常比單純讀到的內容記得更好。Slamecka 與 Graf（1978）讓受試者依規則自己產生字詞（例如給「rapid – f\_\_\_」產生 fast），之後的記憶表現比直接閱讀同一組字詞好。
- Bertsch 等人（2007）的後設分析整合了大量生成效應研究，整體效果約為中等（平均效果量 d 約 0.4），但效果會受材料、測驗類型、延宕時間等條件影響。
- **預先測試（pretesting）**：在學習之前先嘗試回答，即使答錯，之後學習正確答案的效果也可能更好。Richland、Kornell 與 Kao（2009）發現，先對閱讀材料作答（多半答錯）再閱讀，比只是花更多時間閱讀，後測表現更好。
- **有效失敗（productive failure）**：Kapur 的研究（2008、2016）發現，在某些條件下，先讓學生自己嘗試解決還沒學過的問題，再進行正式教學，對概念理解與遷移有幫助。Sinha 與 Kapur（2021）的後設分析支持這個效果，但也指出效果依設計是否忠於原本的做法而異。

### 在 WritingLoop 怎麼用

- Day 1 先寫自己的版本，**送出後**才解鎖範文。學習者先「生成」自己的答案，看範文時就會注意到自己沒想到的寫法。
- Day 1 的作品同時是基準（baseline），Day 7 用來比較進步。
- Day 2～6 的改錯題「先自己改，再看答案」；句型模仿、改寫、段落重組也都要求學習者自己產生內容，而不是只讀。

### 限制與注意

- 生成效應多數在字詞記憶的實驗中得到，不是直接研究「寫作能力」。用在寫作是合理的延伸，不是已證實的結論。
- 生成任務太難、學習者完全產生不出東西時，效果可能消失。預先測試的研究多半是學習者答錯之後**立刻**得到正確答案；如果沒有後續回饋，答錯本身沒有幫助。所以 Day 1 送出後一定要有回饋與範文。
- 有效失敗的效果主要在數學與科學概念學習；用在寫作的證據較少。設計上要避免讓學習者感到挫折：Day 1 的文案要說明「這是起點，寫不好沒關係」。

### 參考文獻

- Slamecka, N. J., & Graf, P. (1978). The generation effect: Delineation of a phenomenon. _Journal of Experimental Psychology: Human Learning and Memory, 4_(6), 592–604. https://doi.org/10.1037/0278-7393.4.6.592
- Bertsch, S., Pesta, B. J., Wiscott, R., & McDaniel, M. A. (2007). The generation effect: A meta-analytic review. _Memory & Cognition, 35_(2), 201–210. https://doi.org/10.3758/BF03193441
- Richland, L. E., Kornell, N., & Kao, L. S. (2009). The pretesting effect: Do unsuccessful retrieval attempts enhance learning? _Journal of Experimental Psychology: Applied, 15_(3), 243–257. https://doi.org/10.1037/a0016496
- Kapur, M. (2008). Productive failure. _Cognition and Instruction, 26_(3), 379–424. https://doi.org/10.1080/07370000802212669
- Kapur, M. (2016). Examining productive failure, productive success, unproductive failure, and unproductive success in learning. _Educational Psychologist, 51_(2), 289–299. https://doi.org/10.1080/00461520.2016.1155457
- Sinha, T., & Kapur, M. (2021). When problem solving followed by instruction works: Evidence for productive failure. _Review of Educational Research, 91_(5), 761–798.

## 2. 提取練習（retrieval practice）

### 原理說明

- 從記憶中把資訊「提取」出來（例如自我測驗），通常比再讀一次更能幫助長期記憶，這稱為測驗效應（testing effect）。
- Roediger 與 Karpicke（2006）發現：讀完文章後做回憶測驗的組別，在幾分鐘後的測驗表現不一定較好，但在 2 天與 1 週後的測驗明顯較好。
- Karpicke 與 Blunt（2011）發現，對科學文章做提取練習，比畫概念圖（concept mapping）的學習效果更好，包括需要推論的題目。
- Rowland（2014）的後設分析確認測驗效應整體穩定（平均效果量約 g = 0.5），並指出有回饋時效果較大。Butler 與 Roediger（2008）也發現，測驗後提供回饋能進一步加強效果。

### 在 WritingLoop 怎麼用

- 「讀 30 秒、蓋住、憑記憶重寫」：學習者要從記憶中提取句子結構與用字。
- 「聽音檔後寫摘要」：把 ListenLoop 的聽力內容從記憶中提取出來，用自己的話寫。
- 錯題本裡的錯誤與句型以題目形式再出現，而不是只讓學習者再看一次。
- Day 7 不看 Day 1 和範文，重寫同一題。
- 每次作答後立即回饋。

### 限制與注意

- 多數研究測的是「記住內容」，不是「寫作品質」。提取練習能幫助記住句型、搭配詞與自己的常見錯誤，但寫作能力還牽涉構思、組織與語感，不能只靠提取練習。
- 提取太難（幾乎都答不出來）而且沒有回饋時，效果會打折。題目難度要讓學習者有機會成功提取，並一定附上回饋。
- 短期內（例如練習後馬上）提取練習的優勢不一定看得出來，學習者可能覺得「再讀一次比較有效」。文案可以說明這是正常的。

### 參考文獻

- Roediger, H. L., III, & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. _Psychological Science, 17_(3), 249–255. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Karpicke, J. D., & Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. _Science, 331_(6018), 772–775. https://doi.org/10.1126/science.1199327
- Rowland, C. A. (2014). The effect of testing versus restudy on retention: A meta-analytic review of the testing effect. _Psychological Bulletin, 140_(6), 1432–1463. https://doi.org/10.1037/a0037559
- Butler, A. C., & Roediger, H. L., III. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. _Memory & Cognition, 36_(3), 604–616. https://doi.org/10.3758/MC.36.3.604

## 3. 間隔重複（spacing）

### 原理說明

- 同樣的練習量，分散在不同時間做，通常比集中在一次做記得更久，稱為間隔效應（spacing effect）。
- Cepeda 等人（2006）的後設分析整合數百個語文記憶實驗，確認分散練習優於集中練習，而且最適合的間隔長度和「要記多久」有關。
- Cepeda 等人（2008）的大型實驗發現：想記得越久，最適合的間隔就越長；最佳間隔大約是保留期間的某個比例（保留期間越長，比例越小），而且間隔稍長通常比稍短的損失小。
- 「間隔逐漸拉長」（expanding）的排程並沒有被證實一定比固定間隔好。Karpicke 與 Roediger（2007）發現，逐漸拉長的間隔對短期記憶較有利，而固定間隔對長期記憶的效果相當或更好；關鍵似乎是第一次複習不要太快。

### 在 WritingLoop 怎麼用

- 錯題本裡的錯誤與好用句型，在 1、3、7 天後再出現。
- 7 天循環本身就是把同一主題的練習分散到一週，而不是一次寫完。

### 限制與注意

- **1、3、7 天是實務上方便、合理的漸進式排程，不是研究證實的最佳間隔。** 它配合 7 天循環，也和常見的間隔複習工具相近。
- 間隔研究多數是字詞、事實等記憶材料；用在寫作句型與文法錯誤是合理的延伸。
- 學習者錯過某天時，排程要能順延，不要讓題目大量堆積。
- 之後若有足夠的使用資料，可以評估是否調整間隔，但要用實際的延宕表現判斷，不要只看練習當下的正確率。

### 參考文獻

- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. _Psychological Bulletin, 132_(3), 354–380. https://doi.org/10.1037/0033-2909.132.3.354
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. _Psychological Science, 19_(11), 1095–1102. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Karpicke, J. D., & Roediger, H. L., III. (2007). Expanding retrieval practice promotes short-term retention, but equally spaced retrieval enhances long-term retention. _Journal of Experimental Psychology: Learning, Memory, and Cognition, 33_(4), 704–719. https://doi.org/10.1037/0278-7393.33.4.704

## 4. 睡眠鞏固與分散練習

### 原理說明

- 睡眠研究顯示，學習之後的睡眠有助於鞏固記憶。Walker 與 Stickgold（2004）的回顧整理了睡眠對程序性記憶（例如動作技能）的證據；Diekelmann 與 Born（2010）的回顧則指出，睡眠對陳述性記憶（事實、字詞）與程序性記憶都有幫助，並討論了可能的機制。
- Dunlosky 等人（2013）評估常見學習技巧時，把「分散練習」與「練習測驗」列為效用最高的兩種，理由是在不同年齡、材料與情境中都有證據。

### 在 WritingLoop 怎麼用

- Day 2～6 每天 10～15 分鐘，而不是一天練一小時。
- 每一天要在不同日曆日才解鎖（和 ListenLoop 的聽力循環規則一致），讓兩次練習之間有睡眠。

### 限制與注意

- **「每天短時間練習」是根據分散練習證據做的設計選擇，不是睡眠研究直接證明的結論。** 睡眠研究多數在實驗室進行，測的是特定記憶作業，不是寫作能力。
- 睡眠對記憶的效果大小、適用的記憶類型與機制仍有爭論；文案不要寫成「睡一覺就會寫」或描述特定腦區的作用。
- 10～15 分鐘是考量學生時間與專注力的實務選擇，沒有研究證實這是最佳長度。

### 參考文獻

- Walker, M. P., & Stickgold, R. (2004). Sleep-dependent learning and memory consolidation. _Neuron, 44_(1), 121–133. https://doi.org/10.1016/j.neuron.2004.08.031
- Diekelmann, S., & Born, J. (2010). The memory function of sleep. _Nature Reviews Neuroscience, 11_(2), 114–126. https://doi.org/10.1038/nrn2762
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology. _Psychological Science in the Public Interest, 14_(1), 4–58. https://doi.org/10.1177/1529100612453266

## 5. 刻意練習（deliberate practice）

### 原理說明

- Ericsson、Krampe 與 Tesch-Römer（1993）提出「刻意練習」：針對自己的弱點設計的練習，有明確目標、需要專注，並且能得到回饋。他們研究音樂學生，發現累積的刻意練習時數和表現水準有關。
- Macnamara、Hambrick 與 Oswald（2014）的後設分析提出重要的修正：刻意練習和表現有關，但只解釋了一部分的個別差異；解釋比例依領域差異很大，在教育領域特別低。也就是說，練習很重要，但不是唯一的因素。

### 在 WritingLoop 怎麼用

- Day 2～6 的預設練習是「聽寫回譯」（D195），句子優先用學習者**自己**第 1 天被修正後的句子，而不是通用的文法題庫。
- 原本依弱點自動安排的 7 種練習（D187）改成「更多練習」，由學習者自己選。2026-11-21 Joe 決定簡化：每天固定一種、10 分鐘的練習比較容易持續，也比較容易說明。
- 每個練習都有明確目標（例如「這次練轉折詞」），並有立即回饋。
- 句型模仿、句子合併、改寫、段落重組等練習，讓學習者在可控的範圍內反覆練同一種能力。Graham 與 Perin（2007）的寫作教學後設分析中，句子合併（sentence combining）對青少年的寫作品質有正面效果。

### 限制與注意

- 「刻意練習」的原始研究對象是專家與長期訓練，和 7 天的寫作練習規模不同；這裡借用的是「針對弱點、有目標、有回饋」的原則。
- 不要宣稱「練滿多少小時就會變成高手」這類說法（常見的「一萬小時」說法是對原研究的簡化）。
- AI 找出的弱點可能不準。要讓學習者能看到為什麼選這些弱點，之後可考慮讓學習者自己調整。

### 參考文獻

- Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. _Psychological Review, 100_(3), 363–406. https://doi.org/10.1037/0033-295X.100.3.363
- Macnamara, B. N., Hambrick, D. Z., & Oswald, F. L. (2014). Deliberate practice and performance in music, games, sports, education, and professions: A meta-analysis. _Psychological Science, 25_(8), 1608–1618. https://doi.org/10.1177/0956797614535810
- Graham, S., & Perin, D. (2007). A meta-analysis of writing instruction for adolescent students. _Journal of Educational Psychology, 99_(3), 445–476. https://doi.org/10.1037/0022-0663.99.3.445

## 6. 交錯練習（interleaving）

### 原理說明

- 交錯練習是把不同類型的題目混在一起練，而不是一種練完再練下一種（blocked）。
- Rohrer 與 Taylor（2007）發現，數學題目混合練習時，練習當下表現較差，但一週後的測驗明顯較好。
- Kornell 與 Bjork（2008）發現，學習辨認不同畫家的畫風時，交錯呈現比集中呈現的效果更好，雖然多數受試者以為集中呈現比較有效。
- Brunmair 與 Richter（2019）的後設分析發現，交錯練習整體有中等的正面效果，但**依材料差異很大**：對類別之間差異細微、需要辨別的材料（例如畫作、部分數學題）效果較好；對某些材料（例如字詞學習）沒有好處，甚至可能較差。

### 在 WritingLoop 怎麼用

- Day 2～6 的練習題把不同錯誤類型混在一起（例如時態、冠詞、轉折詞交錯出現），讓學習者練習「判斷這裡是哪一種問題」。
- 錯題本複習時，不同日期、不同類型的題目混在一起。

### 限制與注意

- 交錯練習的好處主要來自「需要分辨相似的類別」。寫作錯誤類型是否屬於這種材料，目前沒有直接證據；這是合理推論，不是已證實的結論。
- 交錯會讓練習當下感覺比較難、正確率比較低。介面不要因為當下正確率較低就讓學習者以為自己退步。
- 學習者還完全不懂某個規則時，先集中練習幾題再交錯可能比較適合。初版可以在同一次練習中先給 1～2 題同類型題目，再混合。

### 參考文獻

- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. _Instructional Science, 35_(6), 481–498. https://doi.org/10.1007/s11251-007-9015-8
- Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? _Psychological Science, 19_(6), 585–592. https://doi.org/10.1111/j.1467-9280.2008.02127.x
- Brunmair, M., & Richter, T. (2019). Similarity matters: A meta-analysis of interleaved learning and its moderators. _Psychological Bulletin, 145_(11), 1029–1052. https://doi.org/10.1037/bul0000209

## 7. 認知負荷與回饋：為什麼一次只標 3 個問題

### 原理說明

**認知負荷**

- Sweller（1988）提出認知負荷理論：工作記憶容量有限，學習時同時要處理的資訊太多，就會影響學習。
- Sweller、van Merriënboer 與 Paas（2019）回顧此理論 20 年的發展，整理出多種降低不必要負荷的教學設計原則，並指出效果會依學習者的程度而變（對新手有用的引導，對熟手可能變成多餘）。

**回饋研究**

- Hattie 與 Timperley（2007）整理回饋研究，指出有效的回饋要回答三個問題：目標是什麼、現在做得如何、下一步怎麼做；針對作業與學習過程的回饋，比針對個人（例如「你很聰明」）的回饋有效。
- Shute（2008）的回顧提出形成性回饋的設計原則，例如回饋要具體、聚焦，避免一次給太多或太複雜的資訊。
- Kluger 與 DeNisi（1996）的後設分析提醒：回饋整體有正面效果，但有相當比例的研究中回饋反而讓表現變差，特別是把注意力從任務轉到自我評價的回饋。

**第二語言寫作的書面糾正回饋（written corrective feedback）**

- Truscott（1996）主張文法糾正對第二語言寫作沒有幫助，甚至有害，引發長期爭論。Ferris（1999）回應認為這個結論言之過早。
- Ferris（2006）的研究發現，教師的錯誤回饋能幫助學生在修改稿中減少錯誤，部分錯誤類型在長期也有改善。
- Bitchener 與 Ferris（2012）的專書整理這場爭論之後的研究，結論是書面糾正回饋在許多條件下有幫助，但效果依錯誤類型、回饋方式與學習者而異。
- **聚焦式（focused）與非聚焦式（unfocused）回饋**：Ellis、Sheen、Murakami 與 Takashima（2008）在日本 EFL 情境比較只糾正冠詞錯誤的聚焦式回饋與糾正多種錯誤的非聚焦式回饋，兩者都比沒有回饋的組別好；兩種回饋之間的差異不明顯。後續研究對聚焦式回饋是否一定較好，結果並不一致。

### 在 WritingLoop 怎麼用

- Day 1 的 AI 回饋只在文章上標出**最重要的 3 個問題**，加上 1～2 個做得好的地方。
- 較小的問題收在「更多建議」，想看的學習者可以自己展開。
- 每個問題都說明「哪裡有問題、為什麼、可以怎麼改」，對應 Hattie 與 Timperley 的三個問題。
- 回饋只針對文章，不評論學習者本人。
- Day 2～6 的練習只針對這 1～2 個弱點，延續同樣的聚焦。

### 限制與注意

- **「一次 3 個」是根據認知負荷與回饋研究做的設計選擇，研究沒有證明 3 是最佳數字。** 研究支持的是「避免一次給太多回饋」，而不是一個精確的數量。
- 聚焦式回饋比非聚焦式回饋好的證據並不一致。選擇聚焦的主要理由是：降低新手的負荷、讓 Day 2～6 的練習有明確目標，以及避免文章被標滿紅字造成挫折。所以其他問題仍放在「更多建議」，不隱藏。
- AI 判斷「最重要的 3 個」可能出錯（例如把風格偏好當成錯誤）。優先順序的規則要寫在提示詞並納入 AI eval。
- 程度較高的學習者可能需要更多、更細的回饋（專家反轉效應）。之後可以考慮依程度調整。
- 優點回饋要具體（指出哪一句、為什麼好），避免空泛的稱讚。

### 參考文獻

- Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. _Cognitive Science, 12_(2), 257–285. https://doi.org/10.1207/s15516709cog1202_4
- Sweller, J., van Merriënboer, J. J. G., & Paas, F. (2019). Cognitive architecture and instructional design: 20 years later. _Educational Psychology Review, 31_(2), 261–292. https://doi.org/10.1007/s10648-019-09465-5
- Hattie, J., & Timperley, H. (2007). The power of feedback. _Review of Educational Research, 77_(1), 81–112. https://doi.org/10.3102/003465430298487
- Shute, V. J. (2008). Focus on formative feedback. _Review of Educational Research, 78_(1), 153–189. https://doi.org/10.3102/0034654307313795
- Kluger, A. N., & DeNisi, A. (1996). The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory. _Psychological Bulletin, 119_(2), 254–284. https://doi.org/10.1037/0033-2909.119.2.254
- Truscott, J. (1996). The case against grammar correction in L2 writing classes. _Language Learning, 46_(2), 327–369. https://doi.org/10.1111/j.1467-1770.1996.tb01238.x
- Ferris, D. R. (1999). The case for grammar correction in L2 writing classes: A response to Truscott (1996). _Journal of Second Language Writing, 8_(1), 1–11.
- Ferris, D. R. (2006). Does error feedback help student writers? New evidence on the short- and long-term effects of written error correction. In K. Hyland & F. Hyland (Eds.), _Feedback in second language writing: Contexts and issues_ (pp. 81–104). Cambridge University Press.
- Bitchener, J., & Ferris, D. R. (2012). _Written corrective feedback in second language acquisition and writing_. Routledge.
- Ellis, R., Sheen, Y., Murakami, M., & Takashima, H. (2008). The effects of focused and unfocused written corrective feedback in an English as a foreign language context. _System, 36_(3), 353–371. https://doi.org/10.1016/j.system.2008.02.001

## 8. 聽寫回譯（D195）

### 原理說明

- **提取練習**（第 2 節）：聽到或看到意思後，自己把整句寫出來，是一種提取；寫完立刻比對，就是有回饋的提取。
- **輸出假說**：Swain（1995）主張，要求學習者自己說出或寫出語言，會讓他們「注意到」自己想表達的和能表達的之間的落差，進而修正。把自己被修正過的句子重新寫一次，就是在練這個落差。
- **翻譯與對比**：Laufer 與 Girsai（2008）比較了三種教法，發現以對比分析和翻譯（第一語言 ↔ 第二語言）為主的教法，學習者記住單字和搭配詞的效果比只讀文章、或只做第二語言練習好。「看中文寫英文」就是從第一語言的意思寫出第二語言。
- **聽寫類練習**：dictogloss（Wajnryb, 1990）讓學習者聽一段文字後重建，用來把注意力放在文法形式上。WritingLoop 的版本比較簡單：一次一句、可以重播。

### 在 WritingLoop 怎麼用

- 每天 5～8 句、約 10 分鐘。有 AI 批改時，先用自己被修正後的句子（每天最多 3 句），再加上範文的重點句（範文好用句型的例句優先）；沒有批改時用範文的句子。
- 三種方式：聽英文寫英文（預設，練聽清楚每個字與拼字）、看中文寫英文（最接近寫作）、聽英文寫中文意思（練理解）。
- 比對沿用 ListenLoop 的聽寫規則（數字怎麼寫都算對、螢光筆標出寫錯的字），不呼叫 AI；每句以第一次送出的答案為準，避免猜到對為止。
- 第 2～6 天依序換句子，一週下來會輪過整個句子庫；隔天才開放下一天，句子自然分散在不同天。

### 限制與注意

- 上述研究的形式和 WritingLoop 不完全相同：Laufer 與 Girsai 研究的是單字與搭配詞，不是整句寫作；dictogloss 原本是一段文字、分組重建。這裡借用的是原則。
- 「聽英文寫中文意思」只用字元重疊做粗略比對（門檻 40%），同一個意思可以有很多種說法，所以一定會顯示參考意思，分數只當參考。
- 範文以外、自己的句子沒有中文意思時（目前 AI 批改還沒有提供翻譯，見 D195），兩種中文模式會改成聽寫。
- 沒有研究證實「每天 5～8 句」是最佳數量；這是依 10 分鐘與專注力做的實務選擇。

### 參考文獻

- Swain, M. (1995). Three functions of output in second language learning. In G. Cook & B. Seidlhofer (Eds.), _Principle and practice in applied linguistics_ (pp. 125–144). Oxford University Press.
- Laufer, B., & Girsai, N. (2008). Form-focused instruction in second language vocabulary learning: A case for contrastive analysis and translation. _Applied Linguistics, 29_(4), 694–716. https://doi.org/10.1093/applin/amn018
- Wajnryb, R. (1990). _Grammar dictation_. Oxford University Press.

## 9. 聊天練習的隱性糾正（D197）

### 原理說明

- **互動假說**：Long（1996）認為，第二語言學習者在對話中為了理解和被理解而「協商意義」時，會注意到語言形式，這有助於習得。
- **重述（recast）與糾正回饋**：Lyster 與 Ranta（1997）分析課堂裡的糾正回饋，發現「重述」（把學生的話用正確的方式說一次、不中斷對話）最常見，但學生常常沒注意到。Li（2010）的後設分析顯示，口語糾正回饋整體有中等效果，明確的回饋短期效果較大。

### 在 WritingLoop 怎麼用

- 對方照常回覆，不中斷對話（保留互動與意義協商）；錯誤用訊息下方的小標示呈現，點開才看到修正、原因和更自然的說法，把「重述」變成學習者可以主動查看的明確回饋。
- 結束後只整理最重要的 3 個錯誤（認知負荷，第 7 節），並加入錯誤本間隔複習（第 3 節）。

### 限制與注意

- 上述研究多半是面對面的口語互動；文字聊天的節奏、學習者的注意力不同，效果不能直接套用。
- AI 的糾正可能有錯；聊天 eval 會檢查糾正是否正確，但沒辦法涵蓋所有情況。

### 參考文獻

- Long, M. H. (1996). The role of the linguistic environment in second language acquisition. In W. C. Ritchie & T. K. Bhatia (Eds.), _Handbook of second language acquisition_ (pp. 413–468). Academic Press.
- Lyster, R., & Ranta, L. (1997). Corrective feedback and learner uptake: Negotiation of form in communicative classrooms. _Studies in Second Language Acquisition, 19_(1), 37–66. https://doi.org/10.1017/S0272263197001034
- Li, S. (2010). The effectiveness of corrective feedback in SLA: A meta-analysis. _Language Learning, 60_(2), 309–365. https://doi.org/10.1111/j.1467-9922.2010.00561.x

## 10. 信心度與超矯正效應（D202）

### 原理說明

- **超矯正效應（hypercorrection effect）**：Butterfield 與 Metcalfe（2001）發現，學習者很有信心卻答錯的題目，看到正確答案後，反而比沒信心答錯的題目更容易被改正並記住。Metcalfe（2017）的回顧認為，這和「出乎意料」引起的注意力有關。
- **很有信心的錯誤會再回來**：Butler、Fazio 與 Marsh（2011）發現超矯正效應在一週後仍然存在，但部分很有信心的錯誤會「回來」。也就是說，這類錯誤值得在之後再複習一次。
- **答對但不確定的題目也需要回饋**：Butler、Karpicke 與 Roediger（2008）發現，答對但信心低的題目，有回饋時比較記得住；沒有回饋時，這些「猜對」的答案容易忘記。

### 在 WritingLoop 怎麼用

- 聽寫回譯每一句送出前，選「很確定／有點確定／不確定」（一個點選，約 1～2 秒）。
- 送出後，結果旁邊會顯示當時選的信心，讓學習者看到自己的判斷準不準（後設認知）。
- 加入錯誤本時：
  - **很確定卻寫錯**的句子排在最前面（優先複習），結果頁也會特別標示。
  - **寫對但不確定**的句子也加入錯誤本，之後再練一次。
- 可以在寫作設定關閉；關閉時不顯示信心選項，錯誤本照原本的規則。

### 限制與注意

- 原始研究多半用常識問答題（例如「哪個國家的首都是…」），和寫出一整句英文不同。這裡借用的是「依信心決定複習順序」的原則。
- 超矯正效應不代表「很有信心的錯誤比較不嚴重」，只代表看到答案後比較容易改；所以仍要安排複習。
- 自評信心本身就有誤差。這個功能只影響複習順序，不影響分數。

### 參考文獻

- Butterfield, B., & Metcalfe, J. (2001). Errors committed with high confidence are hypercorrected. _Journal of Experimental Psychology: Learning, Memory, and Cognition, 27_(6), 1491–1494. https://doi.org/10.1037/0278-7393.27.6.1491
- Butler, A. C., Karpicke, J. D., & Roediger, H. L., III. (2008). Correcting a metacognitive error: Feedback increases retention of low-confidence correct responses. _Journal of Experimental Psychology: Learning, Memory, and Cognition, 34_(4), 918–928. https://doi.org/10.1037/0278-7393.34.4.918
- Butler, A. C., Fazio, L. K., & Marsh, E. J. (2011). The hypercorrection effect persists over a week, but high-confidence errors return. _Psychonomic Bulletin & Review, 18_(6), 1238–1244. https://doi.org/10.3758/s13423-011-0173-y
- Metcalfe, J. (2017). Learning from errors. _Annual Review of Psychology, 68_, 465–489. https://doi.org/10.1146/annurev-psych-010416-044022

## 11. 鷹架逐漸撤除（D202）

### 原理說明

- **鷹架（scaffolding）**：Wood、Bruner 與 Ross（1976）用這個詞描述有經驗的人在學習者還做不到時提供支持，並在學習者能力提升後逐步撤除。van de Pol、Volman 與 Beishuizen（2010）的回顧把「撤除」（fading）列為鷹架的核心特徵之一。
- **從範例到獨立解題的漸進撤除**：Renkl 與 Atkinson（2003）主張，從完整範例逐步減少提示、到學習者自己完成，比突然從範例跳到獨立作答更好。
- **專業反轉效應（expertise reversal effect）**：Kalyuga 等人（2003）指出，對初學者有幫助的提示，對已經熟練的人反而可能是多餘的負擔。所以提示要隨熟練度減少。

### 在 WritingLoop 怎麼用

- 同一個句子第一次練習時，給比較多的提示：字數和每個字的首字母（例如「M___ p___ w___（6 個字）」）。
- 第二次只給字數；第三次起不給提示。
- 次數依同一題目中這一句之前作答的次數計算（當天任務、額外練習都算）。
- 「聽英文寫中文意思」不給英文提示，因為答案是中文。
- 可以在寫作設定關閉，關閉時都不給提示。

### 限制與注意

- 鷹架研究多半是數學、科學的解題或師生互動，不是寫句子。這裡用的是「提示隨熟練度減少」的原則。
- 首字母提示可能讓學習者只是填空、少了真正的提取。所以只在第一次給，之後就撤除。
- 撤除的速度（3 次）是實務上的選擇，沒有研究指定最佳次數。

### 參考文獻

- Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. _Journal of Child Psychology and Psychiatry, 17_(2), 89–100. https://doi.org/10.1111/j.1469-7610.1976.tb00381.x
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from example study to problem solving in cognitive skill acquisition: A cognitive load perspective. _Educational Psychologist, 38_(1), 15–22. https://doi.org/10.1207/S15326985EP3801_3
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. _Educational Psychologist, 38_(1), 23–31. https://doi.org/10.1207/S15326985EP3801_4
- van de Pol, J., Volman, M., & Beishuizen, J. (2010). Scaffolding in teacher–student interaction: A decade of research. _Educational Psychology Review, 22_(3), 271–296. https://doi.org/10.1007/s10648-010-9127-6

## 12. 自我解釋（D202）

### 原理說明

- Chi 等人（1989）發現，學得比較好的學生在讀範例時，會主動向自己解釋每一步「為什麼」。Chi 等人（1994）進一步證實，**引導**學習者自我解釋，也能提升理解。
- Bisra 等人（2018）的後設分析整理了 64 篇研究，發現引導自我解釋整體有中等效果（約 g = 0.55），在不同年齡和學科都有。

### 在 WritingLoop 怎麼用

- 聽寫回譯寫錯時，先請學習者用一句話寫「我覺得錯在哪裡」（中文也可以），再看答案和逐字比對。
- 寫完的說明會和答案一起顯示，方便對照自己猜得對不對。
- 可以按「略過」直接看答案。
- 每組最多問 2 次，避免拉長每天的時間。
- 可以在寫作設定關閉。

### 限制與注意

- 後設分析裡大部分研究是讀範例、解題或讀說明文，不是外語寫作。
- 自我解釋需要時間。學習者如果只是隨便打幾個字，效果會打折扣。所以只問最多 2 次，而且可以略過。
- 在完全不知道哪裡錯（例如聽不出來的字）時，學習者可能寫不出解釋。這時「略過」是合理的選擇，介面不責備。

### 參考文獻

- Chi, M. T. H., Bassok, M., Lewis, M. W., Reimann, P., & Glaser, R. (1989). Self-explanations: How students study and use examples in learning to solve problems. _Cognitive Science, 13_(2), 145–182. https://doi.org/10.1207/s15516709cog1302_1
- Chi, M. T. H., de Leeuw, N., Chiu, M.-H., & LaVancher, C. (1994). Eliciting self-explanations improves understanding. _Cognitive Science, 18_(3), 439–477. https://doi.org/10.1207/s15516709cog1803_3
- Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. _Educational Psychology Review, 30_(3), 703–725. https://doi.org/10.1007/s10648-018-9434-x

## 13. 睡前回顧（D203）

### 原理說明

- **睡眠與記憶鞏固**：Diekelmann 與 Born（2010）的回顧整理了睡眠幫助記憶鞏固的證據。Gais、Lucas 與 Born（2006）發現，學習後很快就睡覺的組別，比學習後保持清醒一段時間的組別記得更好。
- **睡前提取＋睡眠**：Mazza 等人（2016）讓受試者在兩段練習之間睡覺，發現重新學習更快、一週後和六個月後都記得更多。
- **自由回想**：從記憶中寫出學過的內容，是提取練習的一種（第 2 節）。

### 在 WritingLoop 怎麼用

- 在設定的時間之後（預設 21:30，可以改時間或關閉），當天有做寫作練習時，寫作頁和首頁的今日任務會出現「睡前回顧（約 3 分鐘）」。
- 回顧時先不看任何內容，從記憶寫出今天學到的 3 個句子；寫完再顯示今天練過的句子，對照哪些想起來了。
- 做完會記在寫作日曆。

### 限制與注意

- 睡眠研究多半在實驗室裡學單字對或簡單材料，而且效果因人而異。這裡只說「睡前回想一次對記憶有幫助」，**不說「睡覺時大腦會幫你學英文」**這類說法（見「不使用的神經迷思」）。
- 目前是在 App 裡提醒（打開寫作頁或首頁時出現），不會主動推播。推播提醒要另外設定伺服器排程，列為之後的建議。
- 對作息不規律的人，「睡前」不一定是固定時間，所以可以自己設定時間。

### 參考文獻

- Diekelmann, S., & Born, J. (2010). The memory function of sleep. _Nature Reviews Neuroscience, 11_(2), 114–126. https://doi.org/10.1038/nrn2762
- Gais, S., Lucas, B., & Born, J. (2006). Sleep after learning aids memory recall. _Learning & Memory, 13_(3), 259–262. https://doi.org/10.1101/lm.132106
- Mazza, S., Gerbier, E., Gustin, M.-P., Kasikci, Z., Koenig, O., Toppino, T. C., & Magnin, M. (2016). Relearn faster and retain longer: Along with practice, sleep makes perfect. _Psychological Science, 27_(10), 1321–1330. https://doi.org/10.1177/0956797616659930

## 14. 第 30 天延遲重寫（D203）

### 原理說明

- **學習和表現不同**：Soderstrom 與 Bjork（2015）的回顧指出，練習當下的表現（performance）不一定代表長期學習（learning）。要知道學到多少，要隔一段時間再測。
- **保留間隔**：Cepeda 等人（2008）研究不同的學習間隔和測驗時間，發現想要記得越久，就要隔越久再複習。一個月後再寫一次，是一次長間隔的提取，也是一次真正的「長期進步」檢查。
- **合意難度（desirable difficulties）**：Bjork 與 Bjork（2011）指出，當下比較難的練習（例如隔很久再回想），常常帶來比較好的長期學習。

### 在 WritingLoop 怎麼用

- 完成 7 天循環後，從第 1 天起算的第 30 天（第 1 天日期加 29 天）起，今日任務會邀請學習者再寫一次同一個題目。不看之前的文章和範文。
- 寫完用和第 1、7 天相同的方式評分（AI 批改或自評），結果頁並排比較第 1、7、30 天的分數，以及字數、平均句長、用字多樣性。
- 可以略過，也可以在設定關閉。

### 限制與注意

- 30 天是實務上的選擇（大約一個月），研究沒有指定寫作的最佳間隔。
- 同一題重寫，分數進步可能部分來自記得題目和範文，不完全代表整體寫作能力進步（見「產品文案的規則」第 3 點）。
- AI 評分本身有誤差，第 1、7、30 天的差距如果只有幾分，不一定代表真的進步或退步。

### 參考文獻

- Soderstrom, N. C., & Bjork, R. A. (2015). Learning versus performance: An integrative review. _Perspectives on Psychological Science, 10_(2), 176–199. https://doi.org/10.1177/1745691615569000
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. _Psychological Science, 19_(11), 1095–1102. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In M. A. Gernsbacher, R. W. Pew, L. M. Hough, & J. R. Pomerantz (Eds.), _Psychology and the real world: Essays illustrating fundamental contributions to society_ (pp. 56–64). Worth Publishers.

## 15. 新功能的優先順序與每日時間

依「效益（研究證據與對寫作的相關程度）」與「成本（開發、每天多花的時間、API 費用）」排序：

| 順序 | 功能             | 證據                     | 每天多花的時間                    | API 費用                    | 做法                   |
| ---- | ---------------- | ------------------------ | --------------------------------- | --------------------------- | ---------------------- |
| 1    | 鷹架逐漸撤除     | 中（原則明確，形式不同） | 0（反而可能縮短第一次作答的時間） | 無                          | 自動，依練習次數       |
| 2    | 信心度評分       | 中（常識題為主）         | 每句 1～2 秒，約 10 秒            | 無                          | 每句送出前點選         |
| 3    | 自我解釋         | 中高（後設分析）         | 每組最多 2 次，約 40 秒           | 無                          | 寫錯時先寫一句再看答案 |
| 4    | 睡前回顧         | 中（實驗室為主）         | 約 3 分鐘                         | 無                          | App 內提醒，規則比對   |
| 5    | 第 30 天延遲重寫 | 中（學習與表現）         | 那一天寫一篇（可略過）            | 選用（AI 批改計入每週額度） | 今日任務邀請           |

**每日時間**：第 2～6 天的聽寫回譯約 10 分鐘，加上信心度、自我解釋約 1 分鐘、錯誤本複習（每天最多 5 題）約 3 分鐘、睡前回顧約 3 分鐘，合計約 17 分鐘，不超過 20 分鐘。額外練習不算在內。第 1、7 天寫文章的建議時間由題目決定（考試題型較長），新功能在這兩天只會多出睡前回顧。

## 16. 其他有研究支持、但這次只列為建議的功能

以下功能需要真實 API 花費、會改變產品方向，或需要伺服器排程。依規則只列建議，沒有實作。

| 建議                                  | 依據                                                                                  | 預期效果                               | 成本                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| 實作意圖（「我會在 ___ 之後練習」）   | Gollwitzer（1999）；Gollwitzer 與 Sheeran（2006）的後設分析，對達成目標有中到大的效果 | 提高每天練習的持續度                   | 低（不需 API），但會改變首頁的流程，需要 Joe 決定   |
| 睡前回顧的推播提醒                    | 同第 13 節                                                                            | 沒有打開 App 的人也會回顧              | 需要伺服器排程與推播設定（沿用聽力的提醒基礎設施）  |
| AI 判斷睡前回顧寫出的句子是否意思正確 | 回饋研究（第 7 節）                                                                   | 用字不同但意思對的句子也能算「想起來」 | 每次約 US$0.001，計入額度                           |
| 同儕互評（班級內互相看文章）          | Topping（1998）的回顧，同儕評量在寫作上有正面效果                                     | 多一種回饋來源、讀別人的文章           | 改變產品方向（公開文章、隱私、檢舉），需要 Joe 決定 |

- Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. _American Psychologist, 54_(7), 493–503. https://doi.org/10.1037/0003-066X.54.7.493
- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. _Advances in Experimental Social Psychology, 38_, 69–119. https://doi.org/10.1016/S0065-2601(06)38002-1
- Topping, K. (1998). Peer assessment between students in colleges and universities. _Review of Educational Research, 68_(3), 249–276. https://doi.org/10.3102/00346543068003249

## 17. 第 2～6 天：練習自己文章的正確版本，每天換一種提取方式（D218、D219）

### 原理說明

- **自我參照效應（self-reference effect）**：和自己有關的內容記得比較牢（Rogers, Kuiper & Kirker, 1977；Symons & Johnson, 1997 統合分析）。練習自己第 1 天寫的句子（改成正確的英文），比練習別人寫的範文更容易記住，也更容易在自己下次寫作時用出來。
- **注意差距（noticing the gap）**：學習者把自己寫的句子和正確版本放在一起比較，才會注意到兩者的差別，這是習得的關鍵一步（Schmidt, 1990；Swain, 1995 的輸出假說）。第 2 天把「我原本的句子」和「正確版本」並排就是這個目的。
- **由易到難的提取（desirable difficulties）**：同樣的材料，提取越費力，長期記憶越好，前提是學習者還做得到（Bjork & Bjork, 2011）。所以五天依序加難度：
  1. 看著聽（辨認）；
  2. 填空（部分提取）；
  3. 只給首字母或中文（線索提取）；
  4. 看中文寫英文（完整提取）；
  5. 聽完一段默寫整段（成段提取）。
- **鷹架逐漸撤除（fading）**：提示每天減少，從完整句子到首字母，再到沒有英文提示（Renkl & Atkinson, 2003）。和第 11 節的逐次提示是同一個原理，只是放到天與天之間。
- **錯誤優先、間隔重現**：前一天答錯的句子隔天先出現（第 3 節間隔重複、第 10 節超矯正效應）。

### 在 WritingLoop 怎麼用

| 天  | 形式         | 做什麼                                                               | 提取的難度       |
| --- | ------------ | -------------------------------------------------------------------- | ---------------- |
| 2   | 聽與看       | 逐句播放正確版本，同時看到自己原本的句子和改了什麼；聽完按「下一句」 | 辨認（最容易）   |
| 3   | 填空         | 每句藏起 1～3 個關鍵字（優先藏被改過的字），聽完填回去               | 部分提取         |
| 4   | 提示逐漸減少 | 只看每個字的首字母（或中文），寫出整句                               | 線索提取         |
| 5   | 看中文寫英文 | 不看英文，憑中文意思寫出整句（可以聽一次英文當提示）                 | 完整提取         |
| 6   | 默寫段落     | 聽完一整段後寫出整段                                                 | 成段提取（最難） |

- 每天的形式可以在寫作設定裡改（例如第 4 天改成看中文寫英文），也可以選原本的「聽寫回譯」。
- 前一天答錯的句子，隔天排在最前面。

### 限制與注意

- 自我參照效應的研究大多用單字或形容詞清單，不是作文句子；我們推論「自己的句子」也適用，但沒有直接證據。
- 改寫版本的品質決定了練習的品質，所以改寫有自己的 eval（D218），而且「只改錯」等級保留使用者原本的用字。
- 第 6 天的整段默寫對初學者可能太難，所以每段太長時（超過 4 句）會切成小段，一天最多 3 段。
- 第 2 天的「聽與看」沒有作答，所以不算正確率；日曆與學習分析的正確率只算第 3～6 天。

### 參考文獻

- Bjork, E. L., & Bjork, R. A. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In _Psychology and the real world_ (pp. 56–64). Worth.
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from example study to problem solving in cognitive skill acquisition. _Educational Psychologist, 38_(1), 15–22.
- Rogers, T. B., Kuiper, N. A., & Kirker, W. S. (1977). Self-reference and the encoding of personal information. _Journal of Personality and Social Psychology, 35_(9), 677–688.
- Schmidt, R. W. (1990). The role of consciousness in second language learning. _Applied Linguistics, 11_(2), 129–158.
- Swain, M. (1995). Three functions of output in second language learning. In _Principle and practice in applied linguistics_ (pp. 125–144). Oxford University Press.
- Symons, C. S., & Johnson, B. T. (1997). The self-reference effect in memory: A meta-analysis. _Psychological Bulletin, 121_(3), 371–394.

## 不使用的神經迷思

以下說法流傳很廣，但缺乏證據或已被研究否定。產品設計、介面文字、行銷文案、社群貼文都**不可以使用**，也不要用類似的說法暗示。

| 迷思                                                                      | 為什麼不用                                                                                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 左腦型／右腦型學習者                                                      | 大腦兩側確實有功能分工，但沒有證據顯示人可以分成「左腦型」「右腦型」。Nielsen 等人（2013）的腦造影研究沒有發現個人整體偏向某一側的證據。       |
| 學習風格（例如 VARK：視覺型、聽覺型、讀寫型、動覺型），依風格教學效果較好 | Pashler 等人（2008）檢視研究後發現，幾乎沒有符合嚴格設計的證據支持「依學習風格配對教學」能提升學習。人有偏好，但偏好不等於照偏好教就學得更好。 |
| 「人只用了大腦的 10%」                                                    | 沒有科學根據。腦造影顯示大腦各區在不同作業中都會活動。                                                                                         |
| 健腦操（Brain Gym）                                                       | 宣稱的機制沒有科學根據，相關研究的證據薄弱（見 Hyatt, 2007）。                                                                                 |
| 莫札特效應（聽古典音樂讓人變聰明）                                        | 原始研究的效果很小、很短暫，後續後設分析不支持有特定的「莫札特效應」（Chabris, 1999；Pietschnig 等人, 2010）。                                 |

其他要避免的說法：「開發右腦」「激活大腦潛能」「黃金學習期一過就學不會」，以及沒有出處的特定腦區或神經傳導物質說明（例如「釋放多巴胺讓你愛上寫作」）。Dekker 等人（2012）的調查發現，這類迷思在教師之間也很常見，所以團隊成員寫文案時也要留意。

### 參考文獻

- Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). Learning styles: Concepts and evidence. _Psychological Science in the Public Interest, 9_(3), 105–119. https://doi.org/10.1111/j.1539-6053.2009.01038.x
- Nielsen, J. A., Zielinski, B. A., Ferguson, M. A., Lainhart, J. E., & Anderson, J. S. (2013). An evaluation of the left-brain vs. right-brain hypothesis with resting state functional connectivity magnetic resonance imaging. _PLoS ONE, 8_(8), e71275. https://doi.org/10.1371/journal.pone.0071275
- Hyatt, K. J. (2007). Brain Gym: Building stronger brains or wishful thinking? _Remedial and Special Education, 28_(2), 117–124.
- Chabris, C. F. (1999). Prelude or requiem for the "Mozart effect"? _Nature, 400_(6747), 826–827. https://doi.org/10.1038/23608
- Pietschnig, J., Voracek, M., & Formann, A. K. (2010). Mozart effect–Shmozart effect: A meta-analysis. _Intelligence, 38_(3), 314–323. https://doi.org/10.1016/j.intell.2010.03.001
- Dekker, S., Lee, N. C., Howard-Jones, P., & Jolles, J. (2012). Neuromyths in education: Prevalence and correlates of misconceptions among teachers. _Frontiers in Psychology, 3_, 429. https://doi.org/10.3389/fpsyg.2012.00429

## 產品文案的規則

介面文字、說明頁、行銷文案、應用程式商店描述都要遵守。

1. **用溫和、準確的動詞。**
   - 可以說：「研究顯示，先自己寫再看範文，對學習有幫助」「這種練習方式有研究支持」。
   - 不可以說：「保證進步」「科學證明」「100% 有效」「最有效的方法」。
2. **不承諾進步幅度。** 不寫「7 天寫作分數提升 30%」「多益寫作加 20 分」這類數字。研究的效果量是一群人的平均，不能換成個人保證。
3. **使用者自己的數據可以顯示，但要說清楚是什麼。** 例如「你的 Day 7 分數比 Day 1 高 12 分」可以；但要說明這是 AI 評分，同一題重寫本來就可能進步，不代表整體寫作能力提升同樣幅度。
4. **引用研究時要能附出處。** 說明頁提到某個原理時，連到這份文件列出的文獻（或附作者與年份）。不引用這份文件沒有列出的研究；要新增時先補進這份文件。
5. **說明「當下比較難」是正常的。** 交錯練習、提取練習、先寫再看範文，當下都可能覺得比較難、分數比較低。文案可以說「覺得難是正常的，這通常代表你在練習回想」，但不要說「越難越有效」。
6. **不使用上面列出的神經迷思**，也不使用「大腦」「神經」等字眼包裝沒有根據的說法。
7. **AI 回饋不是權威。** 文案要讓使用者知道 AI 可能出錯，例如「AI 建議僅供參考，有疑問可以問老師」。
8. **不貶低使用者。** Day 1 的文案強調「這是你的起點」，回饋只針對文章，不評論人。
9. **介面文字一律放在翻譯檔**（`messages/zh-Hant.json`、`messages/en.json`），英文版同樣遵守以上規則。
