/**
 * Material categories (P0, D57): category > scenario, and for exam
 * listening, exam > part plus a target level. One list for everything
 * that sorts or makes material: AI-written practice, the admin's
 * material list, and the library's filters. Names live in the message
 * files under `categories`; each scenario's `prompt` is what the model is
 * asked to write about, and `format` the usual form (the learner can
 * change it).
 *
 * Exam styles imitate the format and difficulty only: the content is
 * always original, never a real test item, and the interface says
 * "TOEFL-style", never implying an official tie (D57).
 */
export type Scenario = {
  id: string;
  prompt: string;
  format: "dialogue" | "monologue";
};

const s = (
  id: string,
  format: Scenario["format"],
  prompt: string,
): Scenario => ({ id, format, prompt });

export const CATEGORIES = [
  {
    id: "daily-life",
    scenarios: [
      s("restaurant", "dialogue", "ordering food at a restaurant"),
      s("coffee-shop", "dialogue", "ordering at a coffee shop"),
      s("supermarket", "dialogue", "shopping at a supermarket"),
      s(
        "online-return",
        "dialogue",
        "returning an item bought online, by phone or chat with customer service",
      ),
      s(
        "directions",
        "dialogue",
        "asking for directions and using public transportation",
      ),
      s("doctor", "dialogue", "seeing a doctor about a common illness"),
      s(
        "pharmacy",
        "dialogue",
        "buying medicine at a pharmacy and asking how to take it",
      ),
      s("bank-post", "dialogue", "errands at a bank or a post office"),
      s(
        "apartment-viewing",
        "dialogue",
        "viewing an apartment to rent and asking the landlord questions",
      ),
      s(
        "repairs",
        "dialogue",
        "asking a landlord to fix something broken in an apartment",
      ),
      s(
        "emergency",
        "dialogue",
        "asking for help in an emergency (calling for help, reporting a lost wallet)",
      ),
    ],
  },
  {
    id: "travel",
    scenarios: [
      s(
        "airport-check-in",
        "dialogue",
        "checking in and boarding at an airport",
      ),
      s(
        "immigration",
        "dialogue",
        "answering questions at immigration and customs on arrival",
      ),
      s(
        "hotel",
        "dialogue",
        "checking in at a hotel and making a polite complaint",
      ),
      s(
        "sightseeing",
        "monologue",
        "a tour guide introducing a (fictional) tourist attraction",
      ),
      s("car-rental", "dialogue", "renting a car and getting gas"),
      s("lost", "dialogue", "being lost in a new city and asking for help"),
      s(
        "train-station",
        "dialogue",
        "buying train tickets and asking about platforms at a train station",
      ),
      s(
        "tour-booking",
        "dialogue",
        "booking a local day tour and asking what it includes",
      ),
    ],
  },
  {
    id: "study-abroad",
    scenarios: [
      s(
        "arrival-check-in",
        "dialogue",
        "checking in at a university's international student orientation after arriving",
      ),
      s(
        "bank-account",
        "dialogue",
        "opening a bank account as an international student",
      ),
      s(
        "phone-plan",
        "dialogue",
        "getting a phone plan and SIM card as a new international student",
      ),
      s(
        "roommates",
        "dialogue",
        "talking things through with a roommate (chores, noise, guests)",
      ),
      s(
        "dorm-rules",
        "monologue",
        "a resident assistant explaining dormitory rules",
      ),
      s(
        "international-office",
        "dialogue",
        "sorting out visa paperwork at the international student office",
      ),
      s(
        "course-registration",
        "dialogue",
        "registering for classes and adding or dropping a course with an advisor",
      ),
      s(
        "health-center",
        "dialogue",
        "visiting the campus health center and asking about student health insurance",
      ),
      s(
        "campus-job-interview",
        "dialogue",
        "an interview for a part-time campus job",
      ),
      s(
        "club-fair",
        "dialogue",
        "a student club recruiting new members at a club fair",
      ),
    ],
  },
  {
    id: "casual-american",
    scenarios: [
      s(
        "friends-chat",
        "dialogue",
        "friends chatting casually in American English",
      ),
      s("small-talk", "dialogue", "small talk with a neighbor or a classmate"),
      s("weekend-plans", "dialogue", "making weekend plans with friends"),
      s("fitness", "dialogue", "talking about working out and staying fit"),
      s(
        "food-picks",
        "dialogue",
        "recommending favorite foods and places to eat",
      ),
      s(
        "shows-movies",
        "dialogue",
        "talking about TV series and movies (invented titles)",
      ),
      s(
        "slang",
        "dialogue",
        "everyday American slang and popular expressions, used naturally in conversation",
      ),
      s(
        "social-media",
        "dialogue",
        "talking about social media, with common social media expressions",
      ),
      s(
        "holidays",
        "dialogue",
        "talking about American holidays and how people celebrate them",
      ),
    ],
  },
  {
    id: "campus",
    scenarios: [
      s("class-discussion", "dialogue", "a class discussion at a university"),
      s(
        "office-hours",
        "dialogue",
        "a student visiting a professor's office hours",
      ),
      s(
        "ta",
        "dialogue",
        "a student asking a teaching assistant about an assignment",
      ),
      s(
        "group-project",
        "dialogue",
        "students dividing up the work for a group presentation",
      ),
      s(
        "library",
        "dialogue",
        "a librarian helping a student find research sources",
      ),
      s(
        "academic-integrity",
        "monologue",
        "an instructor explaining academic integrity rules (citations, collaboration, AI tools)",
      ),
      s(
        "lab-safety",
        "monologue",
        "a teaching assistant explaining lab safety rules before a class",
      ),
      s(
        "campus-tour",
        "monologue",
        "a student guide giving new students a campus tour",
      ),
    ],
  },
  {
    id: "academic-writing",
    scenarios: [
      s(
        "abstract",
        "monologue",
        "the abstract of a (fictional) research paper, read aloud",
      ),
      s(
        "methods",
        "monologue",
        "a researcher explaining the methods of a (fictional) study",
      ),
      s(
        "literature-review",
        "monologue",
        "a short literature review on a general academic topic, without citing real papers",
      ),
      s(
        "academic-paragraph",
        "monologue",
        "paragraphs from an academic article",
      ),
      s(
        "conference-talk",
        "monologue",
        "a short conference presentation followed by one audience question and the answer",
      ),
      s(
        "research-proposal",
        "monologue",
        "presenting a short research proposal: question, method, and plan",
      ),
      s(
        "peer-review-feedback",
        "dialogue",
        "two students giving each other feedback on paper drafts",
      ),
      s(
        "thesis-defense",
        "dialogue",
        "answering a committee's questions at a short thesis defense",
      ),
    ],
  },
  {
    id: "business",
    scenarios: [
      s("job-interview", "dialogue", "a job interview at a company"),
      s(
        "elevator-pitch",
        "monologue",
        "a 1-minute elevator pitch introducing yourself or a project",
      ),
      s("meeting", "dialogue", "a work meeting or video call"),
      s("phone-call", "dialogue", "a business phone call"),
      s("email-aloud", "monologue", "a work email, read aloud"),
      s(
        "product-presentation",
        "monologue",
        "presenting a (fictional) product to clients",
      ),
      s(
        "negotiation",
        "dialogue",
        "negotiating a price or deadline with a business partner",
      ),
      s("customer-service", "dialogue", "a customer service call"),
      s("coworker-chat", "dialogue", "chatting with a coworker during a break"),
      s(
        "performance-feedback",
        "dialogue",
        "a manager giving an employee performance feedback",
      ),
    ],
  },
  {
    id: "news",
    scenarios: [
      s(
        "news-tech",
        "monologue",
        "an original news-style report about technology (invented, not about real events or companies)",
      ),
      s(
        "news-business",
        "monologue",
        "an original news-style report about business and the economy (invented, not about real events or companies)",
      ),
      s(
        "news-health",
        "monologue",
        "an original news-style report about health (invented, not about real events)",
      ),
      s(
        "news-environment",
        "monologue",
        "an original news-style report about the environment (invented, not about real events)",
      ),
      s(
        "news-education",
        "monologue",
        "an original news-style report about education (invented, not about real events)",
      ),
      s(
        "news-sports",
        "monologue",
        "an original news-style report about sports (invented, not about real events or teams)",
      ),
      s(
        "news-culture",
        "monologue",
        "an original news-style report about arts and culture (invented, not about real events)",
      ),
      s(
        "news-science",
        "monologue",
        "an original news-style report about a science discovery (invented, not about real events)",
      ),
    ],
  },
  {
    id: "science",
    scenarios: [
      s(
        "science",
        "monologue",
        "explaining a science topic for a general audience",
      ),
      s(
        "psychology",
        "monologue",
        "explaining a psychology idea for a general audience",
      ),
      s(
        "history",
        "monologue",
        "telling a part of world history for a general audience",
      ),
      s("art", "monologue", "introducing an art movement or a kind of art"),
      s(
        "how-tech-works",
        "monologue",
        "explaining how an everyday technology works",
      ),
      s(
        "space",
        "monologue",
        "explaining a topic about space and the planets for a general audience",
      ),
      s(
        "climate",
        "monologue",
        "explaining how the climate and weather work for a general audience",
      ),
      s(
        "nutrition-science",
        "monologue",
        "explaining the science of nutrition and healthy eating",
      ),
    ],
  },
  {
    id: "talks-stories",
    scenarios: [
      s("ted-talk", "monologue", "a TED-style talk"),
      s("graduation-speech", "monologue", "a graduation speech"),
      s(
        "personal-growth",
        "monologue",
        "a personal story about growing from a difficult experience",
      ),
      s("inspirational", "monologue", "an inspirational speech"),
      s("product-launch", "monologue", "a (fictional) product launch event"),
      s(
        "podcast-interview",
        "dialogue",
        "a relaxed podcast interview about someone's interesting job",
      ),
      s(
        "book-review",
        "monologue",
        "a short spoken review of a (fictional) book",
      ),
      s(
        "travel-story",
        "monologue",
        "a personal story about something unexpected on a trip",
      ),
    ],
  },
  {
    id: "health",
    scenarios: [
      s(
        "symptoms",
        "dialogue",
        "describing symptoms to a doctor during a check-up",
      ),
      s(
        "dentist",
        "dialogue",
        "a visit to the dentist for a toothache or a cleaning",
      ),
      s(
        "appointment-booking",
        "dialogue",
        "calling a clinic to book or change a doctor's appointment",
      ),
      s(
        "insurance-claim",
        "dialogue",
        "asking an insurance company how to claim medical costs",
      ),
      s(
        "counseling-booking",
        "dialogue",
        "calling to book a first session with a counselor",
      ),
      s(
        "eye-exam",
        "dialogue",
        "an eye exam and choosing glasses at an optician",
      ),
      s(
        "physical-therapy",
        "dialogue",
        "a physical therapist explaining exercises for a sports injury",
      ),
      s(
        "vaccination",
        "dialogue",
        "getting a vaccine and asking about side effects",
      ),
    ],
  },
  {
    id: "relationships",
    scenarios: [
      s(
        "family-gathering",
        "dialogue",
        "chatting with relatives at a family gathering",
      ),
      s(
        "roommate-conflict",
        "dialogue",
        "talking through a conflict with a roommate calmly",
      ),
      s("dating", "dialogue", "getting to know someone on a first date"),
      s("apologizing", "dialogue", "apologizing to a friend and making up"),
      s(
        "declining-invitation",
        "dialogue",
        "politely turning down an invitation",
      ),
      s(
        "neighbors",
        "dialogue",
        "meeting a new neighbor and asking a small favor",
      ),
      s(
        "comforting-friend",
        "dialogue",
        "comforting a friend who is having a hard week",
      ),
      s("family-video-call", "dialogue", "a video call with family back home"),
    ],
  },
  {
    id: "tech",
    scenarios: [
      s(
        "tech-support",
        "dialogue",
        "calling customer support to fix a laptop or internet problem",
      ),
      s(
        "online-shopping-refund",
        "dialogue",
        "asking an online shop for a refund on a wrong order",
      ),
      s(
        "account-security",
        "dialogue",
        "recovering a hacked account and setting up two-step login",
      ),
      s(
        "ai-tools",
        "dialogue",
        "friends talking about how they use AI tools for study and work, and their limits",
      ),
      s(
        "remote-work",
        "dialogue",
        "teammates planning how to work well remotely",
      ),
      s(
        "smartphone-setup",
        "dialogue",
        "helping a family member set up a new smartphone",
      ),
      s(
        "video-call-issues",
        "dialogue",
        "fixing audio and video problems at the start of an online meeting",
      ),
      s(
        "subscriptions",
        "dialogue",
        "comparing and cancelling streaming subscriptions",
      ),
    ],
  },
  {
    id: "money-admin",
    scenarios: [
      s(
        "bank-transfer",
        "dialogue",
        "making a bank transfer and asking about fees",
      ),
      s(
        "tax-filing",
        "dialogue",
        "asking how to file taxes for the first time",
      ),
      s(
        "paying-bills",
        "dialogue",
        "sorting out a wrong utility bill with customer service",
      ),
      s(
        "lease-terms",
        "dialogue",
        "going over the terms of an apartment lease before signing",
      ),
      s(
        "government-office",
        "dialogue",
        "getting a document at a government office",
      ),
      s(
        "budgeting",
        "dialogue",
        "two friends making a monthly budget together",
      ),
      s(
        "card-dispute",
        "dialogue",
        "disputing a charge on a credit card statement",
      ),
      s(
        "scholarship-application",
        "dialogue",
        "asking an office about applying for a scholarship",
      ),
    ],
  },
  {
    id: "career",
    scenarios: [
      s(
        "resume-walkthrough",
        "dialogue",
        "walking an interviewer through one's resume",
      ),
      s(
        "salary-negotiation",
        "dialogue",
        "negotiating salary and benefits after a job offer",
      ),
      s(
        "internship-interview",
        "dialogue",
        "an interview for a summer internship",
      ),
      s(
        "networking-event",
        "dialogue",
        "meeting people and exchanging contacts at a networking event",
      ),
      s("exit-interview", "dialogue", "an exit interview when leaving a job"),
      s("career-advice", "dialogue", "asking a mentor for career advice"),
      s(
        "first-day",
        "dialogue",
        "the first day at a new job: introductions and a tour",
      ),
      s(
        "career-fair",
        "dialogue",
        "talking to recruiters at a university career fair",
      ),
    ],
  },
  {
    id: "leisure",
    scenarios: [
      s(
        "gym-signup",
        "dialogue",
        "signing up for a gym membership and asking about classes",
      ),
      s(
        "sports-chat",
        "dialogue",
        "friends chatting about a game they watched",
      ),
      s("outdoor-activity", "dialogue", "planning a hike or a bike ride"),
      s("trip-planning", "dialogue", "planning a weekend trip together"),
      s(
        "music-exhibition",
        "dialogue",
        "talking about a concert or an art exhibition",
      ),
      s(
        "movie-night",
        "dialogue",
        "choosing a movie and talking about it afterwards",
      ),
      s(
        "hobby-class",
        "dialogue",
        "joining a pottery, dance, or photography class",
      ),
      s(
        "ticket-booking",
        "dialogue",
        "booking tickets for a show or a game by phone",
      ),
    ],
  },
  {
    id: "food",
    scenarios: [
      s(
        "restaurant-booking",
        "dialogue",
        "calling a restaurant to book a table",
      ),
      s(
        "recipe",
        "monologue",
        "explaining how to cook a simple dish step by step",
      ),
      s(
        "dietary-needs",
        "dialogue",
        "explaining allergies or dietary needs when ordering",
      ),
      s(
        "farmers-market",
        "dialogue",
        "buying vegetables and fruit at a market",
      ),
      s(
        "cooking-class",
        "dialogue",
        "a cooking class with an instructor's tips",
      ),
      s(
        "food-delivery",
        "dialogue",
        "sorting out a problem with a food delivery order",
      ),
      s(
        "potluck",
        "dialogue",
        "planning what everyone brings to a potluck party",
      ),
      s(
        "food-culture",
        "monologue",
        "introducing a local dish and the story behind it",
      ),
    ],
  },
  {
    id: "culture",
    scenarios: [
      s(
        "us-holidays",
        "monologue",
        "explaining how Americans celebrate a holiday like Thanksgiving or the Fourth of July",
      ),
      s(
        "taiwan-culture",
        "monologue",
        "introducing a part of Taiwanese culture to international friends",
      ),
      s(
        "culture-shock",
        "dialogue",
        "talking through a cross-cultural misunderstanding",
      ),
      s(
        "religion-etiquette",
        "monologue",
        "explaining polite behavior when visiting a temple, church, or other place of worship",
      ),
      s(
        "holiday-dinner",
        "dialogue",
        "being a guest at a friend's family holiday dinner",
      ),
      s("lunar-new-year", "monologue", "explaining Lunar New Year traditions"),
      s(
        "gift-giving",
        "dialogue",
        "asking what's polite when giving and receiving gifts",
      ),
      s(
        "tipping",
        "dialogue",
        "asking a friend how tipping works in the United States",
      ),
    ],
  },
  {
    id: "classics",
    scenarios: [
      s("fable", "monologue", "a fable retold for learners (public domain)"),
      s(
        "fairy-tale",
        "monologue",
        "a fairy tale retold for learners (public domain)",
      ),
      s(
        "classic-story",
        "monologue",
        "a scene from a classic novel or story, retold for learners (public domain)",
      ),
      s(
        "historic-speech",
        "monologue",
        "a historic speech or document (public domain)",
      ),
      s(
        "public-article",
        "monologue",
        "an article by a U.S. federal agency such as NASA or the National Park Service (public domain)",
      ),
      s("myth", "monologue", "a Greek or Norse myth retold for learners"),
      s(
        "classic-poem",
        "monologue",
        "a short public-domain poem (published before 1929) and what it means",
      ),
      s(
        "historic-letter",
        "monologue",
        "a famous public-domain letter, read and explained for learners",
      ),
    ],
  },
  {
    id: "school",
    scenarios: [
      s(
        "junior-dialogue",
        "dialogue",
        "a conversation on a junior high school topic (Taiwan's curriculum themes)",
      ),
      s(
        "junior-passage",
        "monologue",
        "a short passage on a junior high school topic (Taiwan's curriculum themes)",
      ),
      s(
        "senior-dialogue",
        "dialogue",
        "a conversation on a senior high school topic (Taiwan's curriculum themes)",
      ),
      s(
        "senior-passage",
        "monologue",
        "a short passage on a senior high school topic (Taiwan's curriculum themes)",
      ),
      s(
        "junior-story",
        "monologue",
        "a short story for junior high school students",
      ),
      s(
        "junior-notice",
        "monologue",
        "a school announcement or notice for junior high school students",
      ),
      s(
        "senior-story",
        "monologue",
        "a short story for senior high school students",
      ),
      s(
        "senior-speech",
        "monologue",
        "a short student speech, for example at an assembly or a club",
      ),
    ],
  },
] as const satisfies readonly { id: string; scenarios: readonly Scenario[] }[];

/** A target an exam text is written for, with how to pitch it. */
export type ExamTarget = { id: string; prompt: string; level: Level };

const target = (id: string, level: Level, prompt: string): ExamTarget => ({
  id,
  level,
  prompt,
});

export const EXAMS = [
  {
    id: "toefl",
    style:
      "in the style of the TOEFL iBT listening section (format and difficulty only; the content is original, never a real test item)",
    parts: [
      s(
        "toefl-campus",
        "dialogue",
        "a campus conversation between a student and a university employee or professor",
      ),
      s(
        "toefl-lecture-biology",
        "monologue",
        "part of an academic lecture on biology",
      ),
      s(
        "toefl-lecture-geology",
        "monologue",
        "part of an academic lecture on geology",
      ),
      s(
        "toefl-lecture-history",
        "monologue",
        "part of an academic lecture on history",
      ),
      s(
        "toefl-lecture-art-history",
        "monologue",
        "part of an academic lecture on art history",
      ),
      s(
        "toefl-lecture-psychology",
        "monologue",
        "part of an academic lecture on psychology",
      ),
    ],
    targets: [
      target(
        "toefl-80",
        "intermediate",
        "for a learner aiming at a TOEFL iBT score around 80 (CEFR B1 to B2)",
      ),
      target(
        "toefl-100",
        "advanced",
        "for a learner aiming at a TOEFL iBT score around 100 (CEFR C1)",
      ),
    ],
  },
  {
    id: "ielts",
    style:
      "in the style of the IELTS listening test (format and difficulty only; the content is original, never a real test item)",
    parts: [
      s(
        "ielts-part1",
        "dialogue",
        "a Part 1 conversation about an everyday situation (booking, enquiry)",
      ),
      s(
        "ielts-part2",
        "monologue",
        "a Part 2 monologue about an everyday topic (a guided tour, a facility)",
      ),
      s(
        "ielts-part3",
        "dialogue",
        "a Part 3 academic discussion between students and a tutor",
      ),
      s("ielts-part4", "monologue", "a Part 4 academic lecture"),
    ],
    targets: [
      target(
        "ielts-5.5",
        "intermediate",
        "for a learner aiming at IELTS band 5.5 (CEFR B1)",
      ),
      target(
        "ielts-6.5",
        "intermediate",
        "for a learner aiming at IELTS band 6.5 (CEFR B2)",
      ),
      target(
        "ielts-7.5",
        "advanced",
        "for a learner aiming at IELTS band 7.5 (CEFR C1)",
      ),
    ],
  },
  {
    id: "toeic",
    style:
      "in the style of the TOEIC listening test (format and difficulty only; the content is original, never a real test item)",
    parts: [
      s(
        "toeic-responses",
        "dialogue",
        "short question-and-response exchanges at work",
      ),
      s(
        "toeic-conversation",
        "dialogue",
        "a short conversation between coworkers",
      ),
      s(
        "toeic-announcement",
        "monologue",
        "an announcement or broadcast (office, airport, store)",
      ),
      s("toeic-voicemail", "monologue", "a voicemail message at work"),
    ],
    targets: [
      target(
        "toeic-550",
        "beginner",
        "for a learner aiming at a TOEIC score of 550 (CEFR A2 to B1)",
      ),
      target(
        "toeic-750",
        "intermediate",
        "for a learner aiming at a TOEIC score of 750 (CEFR B1 to B2)",
      ),
      target(
        "toeic-900",
        "advanced",
        "for a learner aiming at a TOEIC score of 900 (CEFR B2 to C1)",
      ),
    ],
  },
  {
    id: "gept",
    style:
      "in the style of Taiwan's GEPT listening test (format and difficulty only; the content is original, never a real test item)",
    parts: [
      s(
        "gept-conversation",
        "dialogue",
        "a short conversation about daily life or school",
      ),
      s("gept-short-talk", "monologue", "a short talk or announcement"),
    ],
    targets: [
      target(
        "gept-elementary",
        "beginner",
        "for the GEPT Elementary level (CEFR A2)",
      ),
      target(
        "gept-intermediate",
        "intermediate",
        "for the GEPT Intermediate level (CEFR B1)",
      ),
      target(
        "gept-high-intermediate",
        "advanced",
        "for the GEPT High-Intermediate level (CEFR B2)",
      ),
      target(
        "gept-advanced",
        "advanced",
        "for the GEPT Advanced level (CEFR C1)",
      ),
    ],
  },
  {
    id: "gsat",
    style:
      "in the style of the listening section of Taiwan's General Scholastic Ability Test (GSAT) English exam (format and difficulty only; the content is original, never a real test item)",
    parts: [
      s(
        "gsat-dialogue",
        "dialogue",
        "a short conversation between two speakers about school or daily life",
      ),
      s(
        "gsat-short-talk",
        "monologue",
        "a short talk, announcement, or radio report",
      ),
    ],
    targets: [
      target(
        "gsat-basic",
        "beginner",
        "for a senior high school learner at a basic level (CEFR A2 to B1)",
      ),
      target(
        "gsat-standard",
        "intermediate",
        "for a senior high school learner aiming at a high GSAT English score (CEFR B1)",
      ),
      target(
        "gsat-top",
        "advanced",
        "for a senior high school learner aiming at the top GSAT English level (CEFR B1 to B2)",
      ),
    ],
  },
] as const satisfies readonly {
  id: string;
  style: string;
  parts: readonly Scenario[];
  targets: readonly ExamTarget[];
}[];

/** The exam category's id, alongside CATEGORIES' ids. */
export const EXAM_CATEGORY = "exam";

/**
 * Practices written for a category the learner named themselves (D82):
 * "Other" in the library's filters. It has no scenarios.
 */
export const OTHER_CATEGORY = "other";

export type CategoryId =
  | (typeof CATEGORIES)[number]["id"]
  | typeof EXAM_CATEGORY
  | typeof OTHER_CATEGORY;
export type ExamId = (typeof EXAMS)[number]["id"];

/** Every category id in display order: exam, then other, last. */
export const CATEGORY_IDS: readonly CategoryId[] = [
  ...CATEGORIES.map((category) => category.id),
  EXAM_CATEGORY,
  OTHER_CATEGORY,
];

/**
 * The categories AI may file a text under when the learner didn't name
 * one (D153): the general categories, or "other" when none fits. Exam
 * listening needs an exam and a target, so it's chosen, never guessed.
 */
export const GUESSABLE_CATEGORIES: readonly CategoryId[] = [
  ...CATEGORIES.map((category) => category.id),
  OTHER_CATEGORY,
];

/** A general category (one from CATEGORIES, not exam or other). */
export const isGeneralCategory = (value: unknown): value is CategoryId =>
  CATEGORIES.some((category) => category.id === value);

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

/** How each general level is pitched to the model. */
export const LEVEL_PROMPTS: Readonly<Record<Level, string>> = {
  beginner: "CEFR A2: short sentences, the most common words",
  intermediate: "CEFR B1: everyday vocabulary, some longer sentences",
  advanced: "CEFR B2 to C1: natural, varied vocabulary and sentence structure",
};

export type ScenarioPlace = {
  category: CategoryId;
  scenario: Scenario;
  /** For exam parts: the exam. */
  exam?: (typeof EXAMS)[number];
};

/** Where a scenario id belongs: its category (and exam), or null. */
export function findScenario(id: unknown): ScenarioPlace | null {
  for (const category of CATEGORIES) {
    for (const scenario of category.scenarios) {
      if (scenario.id === id) return { category: category.id, scenario };
    }
  }
  for (const exam of EXAMS) {
    for (const scenario of exam.parts) {
      if (scenario.id === id)
        return { category: EXAM_CATEGORY, scenario, exam };
    }
  }
  return null;
}

export function findExam(id: unknown): (typeof EXAMS)[number] | null {
  return EXAMS.find((exam) => exam.id === id) ?? null;
}

/** An exam's target by id, or null. */
export function findTarget(
  exam: (typeof EXAMS)[number],
  id: unknown,
): ExamTarget | null {
  return exam.targets.find((t) => t.id === id) ?? null;
}

export const isCategoryId = (value: unknown): value is CategoryId =>
  (CATEGORY_IDS as readonly unknown[]).includes(value);

export const isExamId = (value: unknown): value is ExamId =>
  EXAMS.some((exam) => exam.id === value);

export const isLevel = (value: unknown): value is Level =>
  (LEVELS as readonly unknown[]).includes(value);

/** Every scenario id (exam parts included), for checks and tests. */
export function allScenarioIds(): string[] {
  return [
    ...CATEGORIES.flatMap((c) => c.scenarios.map((x) => x.id)),
    ...EXAMS.flatMap((e) => e.parts.map((x) => x.id)),
  ];
}

/**
 * A target's key in the message files: next-intl keys can't contain
 * ".", so "ielts-6.5" is "ielts-6_5" there. The id itself (stored with
 * practices) keeps its dot.
 */
export const targetMessageKey = (id: string) => id.replaceAll(".", "_");
