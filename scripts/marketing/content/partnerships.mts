import type { Block, MarketingDoc } from "../docx-builder.mts";
import { SITE } from "./facts.mts";

type Letter = {
  audience: string;
  when: string;
  offer: string;
  zhSubject: string;
  zh: string;
  enSubject: string;
  en: string;
};

const zhSign = `〔你的姓名〕\nListenLoop｜〔聯絡 Email〕｜${SITE}`;
const enSign = `〔Your name〕\nListenLoop · 〔contact email〕 · ${SITE}`;

const letters: Letter[] = [
  {
    audience: "補習班",
    when: "第 3 週",
    offer:
      "一個班級免費試用一學期（班級方案開放前由管理員開通），協助建立班級、收集老師回饋。",
    zhSubject: "〔補習班名稱〕英文聽力課的課後練習工具：邀請一個班免費試用",
    zh: [
      "〔窗口稱謂〕您好：",
      "",
      "我是 ListenLoop 的〔姓名〕。ListenLoop 是給台灣學生的英文聽力練習網站：一段 1～3 分鐘的英文練 7 天——第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫並和第 1 天比較，進步會變成具體的數字。",
      "",
      "很多聽力課只有課堂時間，學生回家很難持續練。ListenLoop 的班級功能讓老師建立班級、指派教材與截止日期，看到每位學生第 1 天到第 7 天的正確率變化、卡在哪幾句，也可以匯出 CSV。官方教材涵蓋生活、校園、職場，以及多益、全民英檢、托福、雅思風格的原創練習（非真題）。",
      "",
      "班級方案正式推出前，想邀請貴班〔一個班級／一位老師〕免費試用，我們會協助建立班級。方便的話，我可以在〔日期〕前後安排 20 分鐘線上說明。",
      "",
      "謝謝您撥冗閱讀。",
      "",
      zhSign,
    ].join("\n"),
    enSubject:
      "Listening homework for your English classes: a free trial for one class",
    en: [
      "Dear 〔name〕,",
      "",
      "I'm 〔name〕 from ListenLoop, an English listening course for students in Taiwan. Each lesson is a 1–3 minute clip practiced for seven days: dictation on Day 1, shadowing on Days 2–6, and dictation again on Day 7, compared with Day 1 so progress shows as a number.",
      "",
      "Teachers can create a class, assign lessons with due dates, see each student's Day 1 to Day 7 gain and the sentences they struggle with, and export it as CSV. The library covers daily life, campus, work, and original exam-style practice (TOEIC, GEPT, TOEFL, and IELTS style; not real test items).",
      "",
      "Before our class plan launches, we'd like to offer 〔one class〕 a free trial and help set it up. Could we have a 20-minute call around 〔date〕?",
      "",
      "Thank you for your time.",
      "",
      enSign,
    ].join("\n"),
  },
  {
    audience: "家教老師",
    when: "第 2 週",
    offer:
      "老師與學生免費使用官方教材；班級功能試用；老師自己的講義可以變成有聲教材（免費方案每週 2 分鐘）。",
    zhSubject: "給家教學生的聽力回家作業（免費使用）",
    zh: [
      "〔老師〕您好：",
      "",
      "我是 ListenLoop 的〔姓名〕。看到您在〔平台／社群〕分享的英文教學，想介紹一個可能對家教學生有幫助的工具。",
      "",
      "ListenLoop 讓學生在家用 7 天練一段英文：聽寫、跟讀、再聽寫。老師可以建立班級、指派教材，下次上課前就知道學生哪幾句聽不出來，上課時直接針對這些句子講解連音與語法。也可以把您自己的英文講義變成有聲音、有中英講義的練習。",
      "",
      "官方教材與練習功能都免費；班級功能正式推出前，可以由我們幫您開通試用。有任何意見都歡迎直接回信。",
      "",
      zhSign,
    ].join("\n"),
    enSubject: "Listening homework for your private students (free to use)",
    en: [
      "Hi 〔name〕,",
      "",
      "I'm 〔name〕 from ListenLoop. I saw your English teaching on 〔platform〕 and thought this might help your students.",
      "",
      "ListenLoop has students practice one clip for a week at home: dictation, shadowing, and dictation again. You can create a class and assign lessons, so before each session you already know which sentences they couldn't hear. You can also turn your own handouts into practice with audio and bilingual notes.",
      "",
      "Official lessons and practice are free, and we can switch on the class features for you before the class plan launches. Any feedback is very welcome.",
      "",
      enSign,
    ].join("\n"),
  },
  {
    audience: "大學英文社團",
    when: "第 2 週",
    offer:
      "合辦「7 天聽力挑戰」：社團指定一份教材，社員一起完成 7 天；提供活動說明與宣傳圖，可以到社課做 15 分鐘示範。",
    zhSubject: "邀請〔社團名稱〕合辦「7 天英文聽力挑戰」",
    zh: [
      "〔社長／幹部〕你好：",
      "",
      "我是 ListenLoop 的〔姓名〕，〔你的學校／身分〕。ListenLoop 是一個免費的英文聽力練習網站：一段英文練 7 天，第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫，和第 1 天比較。",
      "",
      "想邀請〔社團名稱〕一起辦一個「7 天聽力挑戰」：社團選一份教材（例如校園生活或多益風格），社員在同一週一起練，每天大約 10～15 分鐘，最後在社課分享第 1 天和第 7 天的差別。我們可以提供活動說明、宣傳圖，也可以到社課做 15 分鐘的示範。",
      "",
      "完全免費，不需要社員付費。如果有興趣，我們可以約個時間聊聊細節。",
      "",
      zhSign,
    ].join("\n"),
    enSubject: "A 7-day English listening challenge with 〔club name〕",
    en: [
      "Hi 〔name〕,",
      "",
      "I'm 〔name〕 from ListenLoop, 〔your school / role〕. ListenLoop is a free English listening course: practice one clip for seven days, with dictation on Day 1, shadowing on Days 2–6, and dictation again on Day 7.",
      "",
      "Would 〔club name〕 like to run a 7-day listening challenge? The club picks one lesson, members practice it in the same week for about 10–15 minutes a day, and share their Day 1 and Day 7 results at a club meeting. We can provide a short guide and graphics, and give a 15-minute demo.",
      "",
      "It's free for members. Happy to chat whenever suits you.",
      "",
      enSign,
    ].join("\n"),
  },
  {
    audience: "海外台灣同學會",
    when: "第 3 週",
    offer:
      "給新生的「出國前生活英文聽力」資源；可在新生說明會或群組分享；留學生活情境教材與當地口音。",
    zhSubject: "給〔同學會名稱〕新生的出國前英文聽力練習（免費）",
    zh: [
      "〔會長／幹部〕您好：",
      "",
      "我是 ListenLoop 的〔姓名〕。ListenLoop 是給台灣學生的免費英文聽力練習網站，其中有一組「留學生活」情境：銀行開戶、辦門號、租屋、看醫生等，也可以依口音（美、英、澳、印）挑選。",
      "",
      "很多新生到當地第一週，卡住的不是課堂英文，而是這些生活對話。想請問同學會是否願意在新生說明會或新生群組分享這個資源？我們可以提供一段簡短的介紹文字與圖片，也很樂意依〔國家／城市〕的需求調整教材主題。",
      "",
      "網站免費，不需要同學會負擔任何費用。謝謝您！",
      "",
      zhSign,
    ].join("\n"),
    enSubject:
      "Free pre-departure English listening practice for 〔association name〕 freshers",
    en: [
      "Dear 〔name〕,",
      "",
      "I'm 〔name〕 from ListenLoop, a free English listening course for Taiwanese students. It includes a study-abroad set: opening a bank account, getting a phone plan, renting a flat, seeing a doctor, with US, UK, Australian, and Indian accents.",
      "",
      "Many new students find their first week's hardest English isn't in class but in these everyday conversations. Would your association be willing to share it at your pre-departure session or in the freshers' group? We can provide a short blurb and an image, and we're happy to add topics for 〔country / city〕.",
      "",
      "It's free; there's no cost to the association. Thank you!",
      "",
      enSign,
    ].join("\n"),
  },
  {
    audience: "英文學習 KOL",
    when: "第 4 週",
    offer:
      "邀請試用與真實評論（不要求正面評價、不寫好稿）；可以共同製作一份主題教材；目前沒有付費業配預算時要說清楚。",
    zhSubject: "想邀請您試用 ListenLoop：7 天練熟一段英文的聽力網站",
    zh: [
      "〔KOL 名稱〕您好：",
      "",
      "我是 ListenLoop 的〔姓名〕，一直有在看您分享的〔具體提到一支影片或一篇貼文，以及你喜歡的地方〕。",
      "",
      "ListenLoop 是一個英文聽力練習網站，方法和您常提到的〔聽寫／跟讀／精聽〕很接近：一段英文練 7 天，第 1 天聽寫、第 2～6 天跟讀、第 7 天再聽寫，和第 1 天比較。聽錯的字會標出原因（連音、弱讀），並在 1、3、7 天後回來複習。",
      "",
      "想邀請您試用，如果覺得對您的觀眾有幫助，再考慮分享；我們不會提供稿子，也不要求正面評價。也很歡迎一起做一份主題教材（例如您挑選的一段文字，用 AI 聲音做成 7 天練習）。〔如果有合作預算，寫在這裡；沒有就寫：目前是個人開發的早期產品，暫時沒有業配預算。〕",
      "",
      "謝謝您花時間看這封信，期待您的回覆。",
      "",
      zhSign,
    ].join("\n"),
    enSubject:
      "Would you try ListenLoop? A week-long loop for English listening",
    en: [
      "Hi 〔name〕,",
      "",
      "I'm 〔name〕 from ListenLoop. I've been following your 〔mention a specific video or post and what you liked about it〕.",
      "",
      "ListenLoop is an English listening course built around methods close to the 〔dictation / shadowing / intensive listening〕 you often talk about: one clip for seven days, with dictation on Day 1, shadowing on Days 2–6, and dictation again on Day 7. Missed words are explained (linking, weak forms) and come back 1, 3, and 7 days later.",
      "",
      "We'd love you to try it and, only if you find it useful, share it. We won't send a script or ask for a positive review. We'd also be happy to make a themed lesson together. 〔If there's a budget, say so; if not: We're an early, independent product and don't have a sponsorship budget yet.〕",
      "",
      "Thank you for reading.",
      "",
      enSign,
    ].join("\n"),
  },
];

const blocks: Block[] = letters.flatMap((letter, i) => [
  { h1: `${i + 2}. ${letter.audience}` },
  {
    p: `**建議寄送時間**：上線${letter.when}\n**我們能提供的**：${letter.offer}`,
  },
  { h2: "中文版" },
  { p: `**主旨**：${letter.zhSubject}` },
  { copy: letter.zh },
  { h2: "English version" },
  { p: `**Subject**: ${letter.enSubject}` },
  { copy: letter.en },
]);

export const partnerships: MarketingDoc = {
  file: "06-合作邀請信",
  title: "合作邀請信",
  subtitle:
    "補習班、家教老師、大學英文社團、海外台灣同學會、英文學習 KOL（中英文各一封）",
  summary:
    "給補習班、家教老師、大學英文社團、海外台灣同學會、英文學習 KOL 的合作邀請信，中文與英文版各一封，附寄送原則。",
  blocks: [
    { h1: "1. 寄送原則" },
    {
      bullets: [
        "〔 〕裡的內容換成實際資訊；一次寄給一個人，第一段提到對方的具體內容，不要大量群發。",
        "主旨具體、短；內文三段以內：你是誰、能給對方什麼、下一步多簡單。",
        "班級方案還沒正式推出：只能說「開放前可以幫你開通試用」，不承諾價格、不收費。",
        "不承諾佣金、分潤或推薦獎勵（目前沒有這些機制）；有合作預算要先由 Joe 決定。",
        "不寄沒有同意的行銷信；對方沒回覆，一週後最多再跟進一次。",
        "海外同學會、外籍老師常用英文，可以只寄英文版，或中英文一起放。",
        "附件：媒體資料包（07-媒體資料包.docx）與 1～2 張截圖即可，不要附太大的檔案。",
      ],
    },
    ...blocks,
    { h1: "7. 跟進信（通用）" },
    {
      copy: "〔稱謂〕您好：\n\n上週寄信邀請〔社團／班級〕試用 ListenLoop，不知道您是否有機會看到？如果現在不方便也完全沒關係；如果有興趣，我隨時可以配合您的時間說明。\n\n謝謝！\n〔你的姓名〕",
    },
  ],
};
