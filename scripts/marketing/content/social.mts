import type { Block, MarketingDoc } from "../docx-builder.mts";

type Post = {
  day: number;
  platform: string;
  topic: string;
  format: string;
  image: string;
  copy: string;
  tags: string;
};

const BASE_TAGS = "#英文聽力 #學英文 #ListenLoop";

const posts: Post[] = [
  {
    day: 1,
    platform: "IG＋Threads",
    topic: "聽得懂，卻不確定",
    format: "單張文字卡",
    image:
      "文字卡：上半「聽得懂大意 ✓」，下半「確定每一個字？」，中間一條橘色細線（#E8590C）。",
    copy: "聽英文的時候，你是不是也這樣——\n大意都懂，但被問「他剛剛說的是 can 還是 can't？」就答不出來。\n\n這不是不夠努力，是「多聽」只訓練了猜大意，沒有訓練「確定」。\n考試和真實對話，常常就差在一個否定詞、一個時態。\n\n明天分享我怎麼用 7 天練一段英文 👀",
    tags: "#英文聽力 #學英文 #英文學習",
  },
  {
    day: 2,
    platform: "IG＋Threads",
    topic: "7 天循環",
    format: "3 張輪播",
    image:
      "第 1 張「第 1 天：聽寫」、第 2 張「第 2～6 天：跟讀」、第 3 張「第 7 天：再聽寫，和第 1 天比」。可用首頁「第一次來？這樣練」的截圖。",
    copy: "一段 1～3 分鐘的英文，練一整週：\n\n📝 第 1 天：一句一句聽寫，每個字對答案\n🗣️ 第 2～6 天：每天跟讀全部的句子\n📈 第 7 天：再聽寫一次，和第 1 天比\n\n進步變成一個數字，比「好像有變好」更有動力。\nListenLoop 的官方教材都免費，連結在個人檔案。",
    tags: "#英文聽力 #聽寫 #跟讀",
  },
  {
    day: 3,
    platform: "IG＋Threads",
    topic: "連音：want to → wanna",
    format: "單張文字卡",
    image:
      "大字「want to → wanna」，下面小字「後面接動詞才會變：I want to go ✓」。",
    copy: "「I wanna go.」你聽得出來是 want to 嗎？\n\n口語裡 want to 常變成 wanna、going to 變成 gonna。\n但只有後面接動詞才會這樣變：\n✅ I'm going to eat → gonna eat\n❌ I'm going to the library（不會變 gonna）\n\n聽寫時常漏掉的字，很多就是這種連音。",
    tags: "#連音 #英文聽力 #英文發音",
  },
  {
    day: 4,
    platform: "Threads",
    topic: "互動：你最常聽不出來的字",
    format: "純文字＋IG 限動投票",
    image: "IG 限動投票：「最常聽不出來的是？」選項 the／a／and／to。",
    copy: "問大家一個問題：\n聽英文時，你最常漏掉的是哪一種字？\n\nA. the、a 這種冠詞\nB. and、to、of 這種小字\nC. 單字本身不認識\nD. 人名、地名\n\n我自己是 B，留言告訴我你的 👇",
    tags: "#英文聽力 #學英文",
  },
  {
    day: 5,
    platform: "IG＋Threads",
    topic: "弱讀：can 和 can't",
    format: "2 張輪播",
    image:
      "第 1 張「I can go / I can't go」；第 2 張用重音符號標出：can 輕、go 重；can't 重。",
    copy: "can 和 can't 聽起來很像？有個小訣竅：\n\nI can go.　→ can 念得很輕（像 kn），重音在 go\nI can't go. → can't 念得比較重、比較長\n\n所以聽到「很輕的 can」，通常是肯定句。\n這種「弱讀」是聽不清楚的最大原因之一。",
    tags: "#英文發音 #弱讀 #英文聽力",
  },
  {
    day: 6,
    platform: "IG",
    topic: "為什麼聽寫有效",
    format: "單張截圖",
    image:
      "第 1 天聽寫結果截圖（`03-dictation-result-phone-light.png`），漏掉的字有底線。",
    copy: "為什麼要聽寫？因為它會逼你面對「以為聽到、其實沒聽到」的字。\n\n只聽的時候，大腦會自動補上意思；\n一打出來，漏掉的 the、of、been 全部現形。\n\n找到盲點，才知道要練什麼。\n（截圖是示範資料）",
    tags: "#聽寫 #英文聽力 #讀書方法",
  },
  {
    day: 7,
    platform: "IG＋Threads",
    topic: "跟讀怎麼做",
    format: "3 張輪播",
    image:
      "第 1 張「聽一句」、第 2 張「念一句」、第 3 張「看漏念的字」。可錄一段跟讀畫面轉成圖。",
    copy: "跟讀不是要你念得跟母語者一樣，而是讓耳朵習慣語速。\n\n做法：\n1️⃣ 聽一句\n2️⃣ 馬上跟著念\n3️⃣ 看哪些字漏念了，再念一次\n\nListenLoop 用瀏覽器的語音辨識幫你對（建議用電腦版 Chrome）；麥克風不方便時，也可以聽完自己念、按「我念完了」。",
    tags: "#跟讀 #shadowing #英文口說",
  },
  {
    day: 8,
    platform: "IG＋Threads",
    topic: "留學生活：銀行開戶",
    format: "單張文字卡",
    image:
      "文字卡：「Could I see your passport and proof of address?」下面中文「可以看你的護照和地址證明嗎？」",
    copy: "剛到國外第一週，最常遇到的英文不是課堂，是這些：\n🏦 開銀行帳戶\n📱 辦手機門號\n🏠 看房、簽約\n🩺 掛號看醫生\n\n行員會問：「Could I see your passport and proof of address?」\n聽不出 proof of address，就會卡在櫃台 😅\n\n出國前先把這些情境聽熟。教材庫的「留學生活」主題可以免費練。",
    tags: "#留學生活 #留學英文 #出國留學",
  },
  {
    day: 9,
    platform: "IG＋Threads",
    topic: "留學生活：租屋看房",
    format: "單張文字卡",
    image:
      "三句問句：「Are utilities included?」「How long is the lease?」「Is there a deposit?」各附中文。",
    copy: "看房時一定會聽到的三句話 🏠\n\nAre utilities included?　水電瓦斯有含在租金裡嗎？\nHow long is the lease?　租約要簽多久？\nIs there a deposit?　需要押金嗎？\n\n房東講話很快，utilities 常一閃而過。\n先用聽寫練到每個字都聽得出來，現場就不用一直說 sorry?",
    tags: "#留學生活 #租屋 #實用英文",
  },
  {
    day: 10,
    platform: "IG＋Threads",
    topic: "多益聽力怎麼練",
    format: "2 張輪播",
    image: "第 1 張「刷 100 題 vs 練熟 1 段」；第 2 張 7 天循環三步驟。",
    copy: "多益聽力卡關的人，常見的狀況是：題目聽得懂一半，選項就開始猜。\n\n與其一天刷 100 題，不如每天 10 分鐘，把一段職場對話聽到每個字都確定。\n\n📌 第 1 天聽寫找盲點\n📌 第 2～6 天跟讀熟悉語速\n📌 第 7 天再聽寫，確認真的會了\n\nListenLoop 有多益風格的原創練習（不是真題，和 ETS 無關）。",
    tags: "#多益 #TOEIC #多益聽力",
  },
  {
    day: 11,
    platform: "IG",
    topic: "第 7 天：和第 1 天比",
    format: "單張截圖",
    image: "第 7 天結果的進步畫面（用自己的真實紀錄截圖）。",
    copy: "這是我第一次完成 7 天循環的結果：\n第 1 天〔真實分數〕→ 第 7 天〔真實分數〕\n\n最大的改變不是分數，是「確定」：\n以前聽完只敢說「大概是這樣」，現在能說「他說的是 had been，不是 has been」。\n\n你也試試看，連結在個人檔案。",
    tags: "#英文聽力 #學習紀錄 #聽寫",
  },
  {
    day: 12,
    platform: "IG＋Threads",
    topic: "聽錯的字 1、3、7 天後回來",
    format: "單張截圖",
    image: "首頁今日任務的「錯字複習」或「我的錯字」頁截圖。",
    copy: "聽寫完最可惜的是：對完答案，下次還是錯一樣的字。\n\n所以 ListenLoop 會把你聽錯的字留下來，\n隔 1 天、3 天、7 天各出現一次：在原句裡挖空，聽了再填。\n\n這是間隔複習：快忘記的時候再想起來，記得最牢。",
    tags: "#間隔複習 #學習方法 #英文單字",
  },
  {
    day: 13,
    platform: "IG",
    topic: "雙語講義與 PDF",
    format: "2 張輪播",
    image: "講義截圖（`04-handout-phone-light.png`）＋列印預覽。",
    copy: "第 1 天聽寫完，才會打開這份教材的講義（先看原文就不準了）：\n\n📄 英中對照\n📚 重點單字（詞性、例句）\n✏️ 文法句型\n🖍️ 你聽錯的字會用螢光筆標出來\n\n可以輸出 PDF 印出來，考前複習很方便。",
    tags: "#英文講義 #英文學習 #讀書方法",
  },
  {
    day: 14,
    platform: "Threads",
    topic: "第 2 週小回顧",
    format: "純文字",
    image: "（純文字，不用圖）",
    copy: "開始分享英文聽力的方法兩週了，整理大家留言最常問的三個問題：\n\n1. 要付錢嗎？→ 官方教材和練習都免費。\n2. 一定要登入嗎？→ 不用；登入才能在手機和電腦同步進度。\n3. 每天要多久？→ 大約 10～15 分鐘。\n\n還有什麼想問的，留言給我 🙌",
    tags: "#英文學習 #學英文",
  },
  {
    day: 15,
    platform: "IG＋Threads",
    topic: "程度測驗",
    format: "單張截圖",
    image: "程度測驗的結果頁截圖（初級／中級／高級與各級正確率）。",
    copy: "不知道從哪一份教材開始？先做 2～3 分鐘的程度測驗。\n\n從簡單到困難聽幾句英文，打出你聽到的字，\n每一級正確率達 60% 就算達到那一級，\n最後推薦適合你的第一份教材。\n\n不用登入，網站上直接做。",
    tags: "#英文程度 #英文聽力 #學英文",
  },
  {
    day: 16,
    platform: "IG＋Threads",
    topic: "四種口音",
    format: "4 張輪播",
    image: "四張卡：美式、英式、澳洲、印度口音，各一句特色說明。",
    copy: "同一個字，不同口音聽起來差很多：\n\n🇺🇸 美式：water 的 t 像 d\n🇬🇧 英式：car 的 r 不捲舌\n🇦🇺 澳洲：day 聽起來像 die\n🇮🇳 印度：語調起伏大、節奏快\n\n要去哪個國家，就多練哪種口音。教材庫可以用「口音」篩選。",
    tags: "#英文口音 #留學英文 #英文聽力",
  },
  {
    day: 17,
    platform: "IG",
    topic: "聽寫後的單字測驗",
    format: "單張截圖",
    image: "單字測驗的「聽音拼字」畫面截圖。",
    copy: "聽寫完還想多練一點？做 3 分鐘的單字測驗：\n\n第 1 關：聽音拼字（可以慢速重播）\n第 2 關：選出正確的中文意思\n\n先考你剛剛聽錯的字，答錯的會加入錯字複習。\n可以按「跳過」，不影響聽寫成績。",
    tags: "#英文單字 #背單字 #英文學習",
  },
  {
    day: 18,
    platform: "IG＋Threads",
    topic: "聆聽模式：三遍聽法",
    format: "3 張輪播",
    image:
      "第 1 張「第 1 遍：盲聽」、第 2 張「第 2 遍：英文字幕」、第 3 張「第 3 遍：英中對照」。",
    copy: "練完聽寫，想再聽熟一點？試試「三遍聽法」：\n\n1️⃣ 第 1 遍：不看字幕，只聽\n2️⃣ 第 2 遍：看英文字幕\n3️⃣ 第 3 遍：看英中對照\n\nListenLoop 的聆聽模式一鍵就能從頭播三遍，字幕會自動切換。第 1 天聽寫完成後開放。",
    tags: "#英文聽力 #聽力練習 #學習方法",
  },
  {
    day: 19,
    platform: "IG＋Threads",
    topic: "每天 10 分鐘",
    format: "單張截圖",
    image: "教材庫「我今天有幾分鐘」的篩選截圖。",
    copy: "「我沒時間練英文」——其實 10 分鐘就夠。\n\n一段 1 分鐘的英文，跟讀一次大約 3～5 分鐘。\n通勤、午休、睡前，選一個固定時段就好。\n\n小技巧：先決定「今天有幾分鐘」，再挑長度剛好的教材，就不會一打開就想放棄 😌",
    tags: "#每天10分鐘 #讀書方法 #英文學習",
  },
  {
    day: 20,
    platform: "IG",
    topic: "學習分析與練習日曆",
    format: "單張截圖",
    image: "學習分析截圖（`05-analytics-phone-light.png`，示範資料）。",
    copy: "我很需要「看得到」的東西才有動力。\n\n登入後，首頁的練習日曆會一格一格變色；\n學習分析會顯示連續天數和每天練習的分鐘數。\n\n不用很厲害，只要日曆不要空太多格 🗓️",
    tags: "#學習紀錄 #自律 #英文學習",
  },
  {
    day: 21,
    platform: "IG＋Threads",
    topic: "弱讀：him、her 的 h 不見了",
    format: "單張文字卡",
    image: "大字「tell him → tell-im」「ask her → ask-er」。",
    copy: "「I'll tell him.」聽起來像「I'll tell-im」？\n\n沒錯，口語裡 him、her、his 的 h 常常不發音，\n和前一個字黏在一起：\ntell him → tell-im\nask her → ask-er\nwhat's his name → what-sis name\n\n下次聽到一個奇怪的字，想想是不是 h 被吃掉了。",
    tags: "#連音 #弱讀 #英文發音",
  },
  {
    day: 22,
    platform: "IG＋Threads",
    topic: "用電影片段練聽力",
    format: "單張截圖",
    image:
      "Sintel 影片練習頁截圖；圖上標示「Sintel © Blender Foundation｜CC BY」。",
    copy: "用電影練聽力，最大的問題是：一部片太長，聽完也不知道自己聽懂多少。\n\n我的做法是只挑 2 分鐘，用 7 天練到每句台詞都聽得出來。\nListenLoop 有 Blender 基金會的開放電影 Sintel（CC BY 授權，網站上有標示出處），\n練完再回去看整部片，那種「全部聽得懂」的感覺很爽 🎬",
    tags: "#電影學英文 #英文聽力 #學英文",
  },
  {
    day: 23,
    platform: "IG＋Threads",
    topic: "把自己的文章變成聽力教材",
    format: "單張截圖",
    image: "建立教材頁截圖（`06-create-phone-light.png`）。",
    copy: "想練課本、講義或自己寫的英文？\n\n貼上一段中文或英文文字（或請 AI 依主題寫一段），選一個聲音（美、英、澳、印口音），\n就會變成有聲音、有講義的 7 天聽力教材。\n\n免費方案每週可以建立 2 分鐘。",
    tags: "#英文學習 #自學英文 #英文聽力",
  },
  {
    day: 24,
    platform: "IG＋Threads",
    topic: "連音：of the",
    format: "單張文字卡",
    image: "大字「one of the → wun-uh-thuh」。",
    copy: "「one of the best」聽起來像「wun-uh-thuh best」？\n\nof 在口語裡常常只剩一個 uh，\n後面的 the 也念得很輕。\n\n聽寫時，如果一個地方「好像有東西但聽不出來」，\n十之八九是 of、the、to 這種小字。",
    tags: "#連音 #英文聽力 #英文發音",
  },
  {
    day: 25,
    platform: "IG",
    topic: "加到主畫面＋練習提醒",
    format: "2 張輪播",
    image: "第 1 張：手機瀏覽器「加入主畫面」步驟；第 2 張：練習提醒設定。",
    copy: "把 ListenLoop 加到手機主畫面，用起來就像 App 📱\n\n還可以開「練習提醒」：每天在你選的時間通知你，當天練過就不吵你。\n（提醒是瀏覽器通知；iPhone 要先加入主畫面才能開。）",
    tags: "#學習習慣 #英文學習",
  },
  {
    day: 26,
    platform: "IG＋Threads",
    topic: "考前一週怎麼用",
    format: "3 張輪播",
    image:
      "三張卡：「考前 7 天選一段考試風格的教材」「每天 10～15 分鐘」「最後一天複習錯字」。",
    copy: "多益、英檢、雅思考前一週，可以這樣用：\n\n1. 選一段考試風格的教材（原創練習，非真題）\n2. 每天跟著 7 天循環練 10～15 分鐘\n3. 考前一天把「我的錯字」全部複習一次\n\n不保證分數，但你會很清楚自己哪裡聽不出來。",
    tags: "#多益 #全民英檢 #雅思",
  },
  {
    day: 27,
    platform: "IG＋Threads",
    topic: "免手動練習",
    format: "單張截圖",
    image: "練習頁「免手動練習（自動播放、自動收音）」開關的截圖。",
    copy: "雙手不方便的時候，可以打開「免手動練習」：\n\n按一次開始，句子會自動播放；\n跟讀時播完自動收音、念完自動判斷，過了就到下一句。\n\n在家裡邊收東西邊練很方便（需要麥克風，建議用 Chrome）。",
    tags: "#跟讀 #英文口說 #學習方法",
  },
  {
    day: 28,
    platform: "Threads",
    topic: "常見問題",
    format: "純文字",
    image: "（純文字，不用圖）",
    copy: "最近被問最多的問題 👇\n\nQ：跟讀會錄下我的聲音嗎？\nA：不會。辨識由瀏覽器處理，網站只存「念對幾成」。\n\nQ：手機可以用嗎？\nA：可以，也能加到主畫面。跟讀建議用電腦版 Chrome，辨識比較穩定。\n\nQ：付費方案什麼時候開放？\nA：還沒開放、也還沒收費，定價頁可以加入等候名單。",
    tags: "#英文學習 #學英文",
  },
  {
    day: 29,
    platform: "IG＋Threads",
    topic: "給老師：班級方案（即將推出）",
    format: "單張文字卡",
    image:
      "文字卡：「老師指派教材 → 學生在家練 7 天 → 老師看到每個人的進步」。",
    copy: "老師和家教可以這樣用 ListenLoop：\n\n👩‍🏫 建立班級、指派教材和截止日期\n📊 看每位學生第 1 天到第 7 天的進步、卡在哪幾句\n📁 匯出 CSV\n\n班級方案即將推出，現在不收費；想先試用的老師歡迎私訊。",
    tags: "#英文老師 #英文教學 #家教",
  },
  {
    day: 30,
    platform: "IG＋Threads",
    topic: "一起挑戰 7 天",
    format: "單張文字卡",
    image: "7 格日曆，每格一個打勾框；標題「7 天聽力挑戰」。",
    copy: "這個月分享了很多聽力方法，最後邀請你一起做一件事：\n\n選一段英文，接下來 7 天每天練 10 分鐘。\n第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫。\n\n完成後回來留言你的第 1 天和第 7 天，我們一起看進步 💪\n連結在個人檔案，官方教材都免費。",
    tags: "#7天挑戰 #英文聽力 #學英文",
  },
];

const weekday = (day: number) => "一二三四五六日"[(day - 1) % 7];

const detail: Block[] = posts.flatMap((post) => [
  { h2: `第 ${post.day} 天：${post.topic}` },
  {
    p: `**平台**：${post.platform}　**形式**：${post.format}\n**建議圖片**：${post.image}`,
  },
  {
    copy: `${post.copy}\n\n${post.tags} ${BASE_TAGS.split(" ")
      .filter((tag) => !post.tags.includes(tag))
      .join(" ")}`.trim(),
  },
]);

export const social: MarketingDoc = {
  file: "03-社群貼文",
  title: "社群貼文",
  subtitle:
    "Instagram／Threads 30 則貼文：文案、建議圖片、主題標籤，排成一個月",
  summary:
    "30 則 Instagram／Threads 貼文的發文日程表（第 1～30 天）與每則的文案、建議圖片、主題標籤。",
  blocks: [
    { h1: "1. 使用說明" },
    {
      bullets: [
        "語氣：像學長姊分享讀書方法，不喊口號、不誇大效果。",
        "第 1 天是上線日（建議週一）。日程表的星期以第 1 天是週一計算，可以整體往後挪。",
        "Instagram 的連結放在個人檔案；Threads 可以在第一則回覆附上網站連結（加 utm 參數，見「上線行銷計畫」）。",
        "圖片用品牌色（黑白為主、橘色點綴），字至少 24pt；截圖在 `docs/portfolio/screenshots/`（示範資料，要註明）。",
        "主題標籤每則 3～6 個，固定加 #ListenLoop。",
        "第 11 天的分數一定要換成真實紀錄（自己或取得同意的使用者）；沒有就改發方法教學。",
        "Threads 的「平台：Threads」貼文是純文字，適合當天回覆留言、建立對話。",
      ],
    },
    { h1: "2. 發文日程表" },
    {
      table: {
        columns: [
          ["天", 1],
          ["星期", 1],
          ["平台", 2],
          ["主題", 4],
          ["形式", 2],
        ],
        rows: posts.map((post) => [
          String(post.day),
          weekday(post.day),
          post.platform,
          post.topic,
          post.format,
        ]),
      },
    },
    { h1: "3. 每則貼文" },
    ...detail,
    { h1: "4. 發文注意" },
    {
      bullets: [
        "不要宣稱「保證進步」「X 天多益 900」；用「我的經驗」「建議」的語氣。",
        "考試相關的貼文都要寫「原創練習，非真題」，不使用考試的 Logo。",
        "不提 YouTube 連結建立教材、Email 提醒、推薦獎勵（目前沒有這些功能）。",
        "留言與私訊 24 小時內回覆；被問到還沒有的功能，就誠實說「還沒有，已經記下來」。",
      ],
    },
  ],
};
