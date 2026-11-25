# 官方教材的來源與授權（D213）

每份官方教材的來源、授權依據與連結。規則：只用原創內容、在美國已進入公有領域的作品（1929 年以前發表）、美國聯邦政府著作（17 U.S.C. §105）。不使用托福、雅思、多益、全民英檢的官方題目與範文、教科書課文、TED 演講，以及仍受著作權保護的演講、新聞、歌詞、電影台詞。

教材檔案在 `data/official/<slug>.json`（聽力）與 `data/writing/prompts/<id>.json`（寫作），`source` 欄位記錄同樣的資訊；`tests/official-written.test.ts` 檢查經典名篇一定有來源。

## 經典名篇（公有領域與美國聯邦政府著作）

| 教材                                                             | 類別／情境                | 程度         | 口音 | 來源                                                                                                                                                   | 授權依據                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------- | ------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Fox and the Grapes（狐狸與葡萄）                             | classics／fable           | beginner     | gb   | 改寫自：[Three Hundred Aesop's Fables (tr. George Fyler Townsend, 1867)](https://www.gutenberg.org/ebooks/21)                                          | Townsend's translation was published in 1867; public domain in the U.S. (pre-1929).                                                                            |
| The Grasshopper and the Ants（蚱蜢與螞蟻）                       | classics／fable           | beginner     | au   | 改寫自：[Three Hundred Aesop's Fables (tr. George Fyler Townsend, 1867)](https://www.gutenberg.org/ebooks/21)                                          | Townsend's translation was published in 1867; public domain in the U.S. (pre-1929).                                                                            |
| The Hare and the Tortoise（龜兔賽跑）                            | classics／fable           | beginner     | gb   | 改寫自：[Three Hundred Aesop's Fables (tr. George Fyler Townsend, 1867)](https://www.gutenberg.org/ebooks/21)                                          | Townsend's translation was published in 1867; public domain in the U.S. (pre-1929).                                                                            |
| A Mad Tea-Party（瘋狂的茶會）                                    | classics／classic-story   | intermediate | gb   | 改寫自：[Alice's Adventures in Wonderland by Lewis Carroll (1865)](https://www.gutenberg.org/ebooks/11)                                                | Published 1865; public domain in the U.S. (pre-1929).                                                                                                          |
| Holmes Reads Watson at a Glance（福爾摩斯一眼看穿華生）          | classics／classic-story   | intermediate | gb   | 改寫自：[The Adventures of Sherlock Holmes by Arthur Conan Doyle (1892; story first published 1891)](https://www.gutenberg.org/ebooks/1661)            | First published in The Strand Magazine in 1891; public domain in the U.S. (pre-1929).                                                                          |
| The Elves and the Shoemaker（小精靈與鞋匠）                      | classics／fairy-tale      | beginner     | au   | 改寫自：[Grimm's Household Tales (tr. Margaret Hunt, 1884)](https://www.gutenberg.org/ebooks/5314)                                                     | Margaret Hunt's translation was published in 1884; public domain in the U.S. (pre-1929).                                                                       |
| The Frog King（青蛙王子）                                        | classics／fairy-tale      | intermediate | in   | 改寫自：[Grimm's Household Tales (tr. Margaret Hunt, 1884)](https://www.gutenberg.org/ebooks/5314)                                                     | Margaret Hunt's translation was published in 1884; public domain in the U.S. (pre-1929).                                                                       |
| Ask Not What Your Country Can Do for You（別問國家能為你做什麼） | classics／historic-speech | advanced     | us   | 原文：[John F. Kennedy, Inaugural Address, January 20, 1961](https://www.archives.gov/milestone-documents/president-john-f-kennedys-inaugural-address) | Delivered by the President in his official capacity, a work of the U.S. federal government, 17 U.S.C. §105.                                                    |
| The Gettysburg Address（蓋茲堡演說）                             | classics／historic-speech | advanced     | us   | 原文：[Abraham Lincoln, Gettysburg Address (Bliss copy), November 19, 1863](https://www.loc.gov/exhibits/gettysburg-address/)                          | Delivered and published 1863; public domain.                                                                                                                   |
| Our Neighbor, the Moon（我們的鄰居：月球）                       | classics／public-article  | intermediate | us   | 改寫自：[NASA Science](https://science.nasa.gov/moon/facts/)                                                                                           | Work of the U.S. federal government (NASA), 17 U.S.C. §105; retold only from NASA's own text, not from third-party images or material on the page.             |
| Old Faithful（老忠實泉）                                         | classics／public-article  | intermediate | us   | 改寫自：[National Park Service, Yellowstone National Park](https://www.nps.gov/articles/old-faithful-geyser.htm)                                       | Work of the U.S. federal government (National Park Service), 17 U.S.C. §105; retold only from the NPS's own text, not from credited photos or partner content. |

## 各類別補充（原創）

| 教材                                                                   | 類別／情境                          | 程度         | 口音 | 來源            | 授權依據 |
| ---------------------------------------------------------------------- | ----------------------------------- | ------------ | ---- | --------------- | -------- |
| The Story in a Bowl of Beef Noodle Soup（一碗牛肉麵裡的故事）          | food／food-culture                  | advanced     | in   | ListenLoop 原創 | 原創     |
| Planning a Blue Mountains Hike（規劃藍山健行）                         | leisure／outdoor-activity           | intermediate | au   | ListenLoop 原創 | 原創     |
| Calling the Counseling Center（打電話到諮商中心）                      | health／counseling-booking          | advanced     | us   | ListenLoop 原創 | 原創     |
| Thirty Seconds at the Career Fair（徵才博覽會的三十秒）                | career／career-fair                 | intermediate | us   | ListenLoop 原創 | 原創     |
| One Minute to Introduce Myself（一分鐘自我推銷）                       | business／elevator-pitch            | intermediate | au   | ListenLoop 原創 | 原創     |
| My First Day in Sydney（在雪梨上班的第一天）                           | career／first-day                   | beginner     | au   | ListenLoop 原創 | 原創     |
| My First Pottery Class（第一堂陶藝課）                                 | leisure／hobby-class                | beginner     | in   | ListenLoop 原創 | 原創     |
| A Gift for a Diwali Dinner（排燈節晚餐該送什麼？）                     | culture／gift-giving                | intermediate | in   | ListenLoop 原創 | 原創     |
| Lunar New Year for My Flatmates（向室友介紹農曆新年）                  | culture／lunar-new-year             | beginner     | gb   | ListenLoop 原創 | 原創     |
| Office Hours After a Low Grade（拿到低分後去找教授）                   | campus／office-hours                | advanced     | in   | ListenLoop 原創 | 原創     |
| A Proposal on Translation Tools（翻譯工具研究計畫）                    | academic-writing／research-proposal | advanced     | gb   | ListenLoop 原創 | 原創     |
| A Sore Throat Before Exams（考試前的喉嚨痛）                           | health／symptoms                    | beginner     | gb   | ListenLoop 原創 | 原創     |
| Tomato and Egg in Ten Minutes（十分鐘番茄炒蛋）                        | food／recipe                        | beginner     | us   | ListenLoop 原創 | 原創     |
| Using AI for Essays: Help or Shortcut?（用 AI 寫報告：幫手還是捷徑？） | tech／ai-tools                      | advanced     | gb   | ListenLoop 原創 | 原創     |
| Buying Cold Medicine in Australia（在澳洲藥局買感冒藥）                | daily-life／pharmacy                | intermediate | au   | ListenLoop 原創 | 原創     |
| Saying No to a Birthday Night Out（婉拒同事的生日聚會）                | relationships／declining-invitation | intermediate | gb   | ListenLoop 原創 | 原創     |
| Filing Taxes for the First Time（第一次在美國報稅）                    | money-admin／tax-filing             | advanced     | us   | ListenLoop 原創 | 原創     |
| Making a Budget with My Flatmate（和室友一起做預算）                   | money-admin／budgeting              | beginner     | au   | ListenLoop 原創 | 原創     |
| My Account Got Hacked（帳號被盜了怎麼辦）                              | tech／account-security              | intermediate | in   | ListenLoop 原創 | 原創     |
| A Polite Complaint at the Hotel（在飯店客氣地抱怨）                    | travel／hotel                       | advanced     | au   | ListenLoop 原創 | 原創     |
| My First Presentation in English（我的第一次英文簡報）                 | talks-stories／personal-growth      | intermediate | us   | ListenLoop 原創 | 原創     |
| Why Sleep Helps You Remember（為什麼睡覺能幫你記憶）                   | science／psychology                 | advanced     | in   | ListenLoop 原創 | 原創     |
| Getting a SIM Card in the UK（在英國辦手機門號）                       | study-abroad／phone-plan            | beginner     | gb   | ListenLoop 原創 | 原創     |
| A Video Call with Dad（和爸爸視訊）                                    | relationships／family-video-call    | beginner     | in   | ListenLoop 原創 | 原創     |
| Weekend Plans: A Hike and Dumplings（週末計畫：健行和包水餃）          | casual-american／weekend-plans      | beginner     | us   | ListenLoop 原創 | 原創     |

## 考試系列（原創模擬，只模仿題型）

| 教材                                                  | 類別／情境                   | 程度         | 口音 | 來源            | 授權依據 |
| ----------------------------------------------------- | ---------------------------- | ------------ | ---- | --------------- | -------- |
| A Birthday Gift for Mom（送媽媽的生日禮物）           | gept／gept-conversation      | beginner     | us   | ListenLoop 原創 | 原創     |
| A Library That Lends Tools（借工具的圖書館）          | gept／gept-short-talk        | advanced     | gb   | ListenLoop 原創 | 原創     |
| Booking a Pottery Course（報名陶藝課）                | ielts／ielts-part1           | intermediate | gb   | ListenLoop 原創 | 原創     |
| Changing a Lab Section（更換實驗課時段）              | toefl／toefl-campus          | intermediate | us   | ListenLoop 原創 | 原創     |
| How Cave Pearls Form（洞穴珍珠是怎麼形成的）          | toefl／toefl-lecture-geology | advanced     | us   | ListenLoop 原創 | 原創     |
| Lift Repairs This Weekend（本週末電梯維修）           | toeic／toeic-announcement    | beginner     | au   | ListenLoop 原創 | 原創     |
| Medicine or Veterinary Science?（醫學系還是獸醫系？） | gsat／gsat-dialogue          | advanced     | us   | ListenLoop 原創 | 原創     |
| A Packaging Delay Before Launch（上市前包裝延誤）     | toeic／toeic-conversation    | advanced     | in   | ListenLoop 原創 | 原創     |
| Signing Up for the Relay（報名大隊接力）              | gsat／gsat-dialogue          | beginner     | us   | ListenLoop 原創 | 原創     |
| The Used Book Exchange（二手書交換活動）              | gsat／gsat-short-talk        | intermediate | us   | ListenLoop 原創 | 原創     |
| When Shipwrecks Become Reefs（當沉船變成珊瑚礁）      | ielts／ielts-part4           | advanced     | au   | ListenLoop 原創 | 原創     |

## 國高中程度（原創，依課綱常見主題）

| 教材                                                    | 類別／情境              | 程度         | 口音 | 來源            | 授權依據 |
| ------------------------------------------------------- | ----------------------- | ------------ | ---- | --------------- | -------- |
| What I Found on the Beach（我在海灘上發現的東西）       | school／senior-passage  | intermediate | au   | ListenLoop 原創 | 原創     |
| What I Learned on Career Day（職涯探索日的收穫）        | school／senior-passage  | advanced     | us   | ListenLoop 原創 | 原創     |
| Choosing a University Department（選擇大學科系）        | school／senior-dialogue | intermediate | us   | ListenLoop 原創 | 原創     |
| Our Exchange Student from Germany（來自德國的交換學生） | school／senior-passage  | advanced     | gb   | ListenLoop 原創 | 原創     |
| Getting Ready for the Field Trip（校外教學行前準備）    | school／junior-dialogue | beginner     | au   | ListenLoop 原創 | 原創     |
| A Letter to My Pen Pal（寫給筆友的信）                  | school／junior-passage  | beginner     | gb   | ListenLoop 原創 | 原創     |
| Recycling Duty at School（資源回收值日）                | school／junior-dialogue | beginner     | us   | ListenLoop 原創 | 原創     |
| Choosing a School Club（選社團）                        | school／junior-dialogue | beginner     | us   | ListenLoop 原創 | 原創     |
| Too Much Time on My Phone（滑手機的時間太多了）         | school／senior-dialogue | intermediate | us   | ListenLoop 原創 | 原創     |
| A Typhoon Day Off（颱風假）                             | school／junior-passage  | beginner     | us   | ListenLoop 原創 | 原創     |

## 寫作題目

2026-11-25 新增的 22 份寫作題目（多益 3、國中程度 3、托福 1、雅思 Task 1 與 Task 2 各 1、全民英檢 1、學測 2、日記 5、生活寫作 5）全部是 ListenLoop 原創，只模仿考試的題型格式；範文與翻譯也是原創。

## 台灣考試試題（學測、分科測驗、國中會考）的查證

- 著作權法第 9 條第 1 項第 5 款：「依法令舉行之各類考試試題及其備用試題」不得為著作權之標的。學測、分科測驗（大學入學考試中心依大學法及大學多元入學方案辦理）、國中教育會考（依國民教育法及高級中等教育法相關規定辦理）屬於依法令舉行的考試，試題本身原則上不受著作權保護。
- **但**試題中引用的文章、圖片、對話如果取自他人的著作（例如報章雜誌、書籍、網站文章），那些被引用的著作**仍然受原著作權人保護**，不因被放進試題而變成公有領域。英文科的閱讀測驗與聽力題常改寫或引用外部文章，個別題目的出處通常沒有標示，無法逐題確認。
- 錄音（聽力測驗的音檔）是另外的錄音著作，是否屬於「試題」的一部分有爭議。
- **結論**：依規則「不確定的一律不用」，這次**沒有使用任何真實的學測、分科測驗或會考試題**；學測風格的 3 份聽力與 2 份寫作都是原創，只模仿題型與難度。日後若要收錄真實試題，只考慮大考中心公布、確定沒有引用外部文章的題目（例如自行撰寫的短對話），並逐題記錄在這份文件。
