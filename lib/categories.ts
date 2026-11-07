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
] as const satisfies readonly {
  id: string;
  style: string;
  parts: readonly Scenario[];
  targets: readonly ExamTarget[];
}[];

/** The exam category's id, alongside CATEGORIES' ids. */
export const EXAM_CATEGORY = "exam";

export type CategoryId =
  (typeof CATEGORIES)[number]["id"] | typeof EXAM_CATEGORY;
export type ExamId = (typeof EXAMS)[number]["id"];

/** Every category id, exam last, in display order. */
export const CATEGORY_IDS: readonly CategoryId[] = [
  ...CATEGORIES.map((category) => category.id),
  EXAM_CATEGORY,
];

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

export const isLevel = (value: unknown): value is Level =>
  (LEVELS as readonly unknown[]).includes(value);

/** Every scenario id (exam parts included), for checks and tests. */
export function allScenarioIds(): string[] {
  return [
    ...CATEGORIES.flatMap((c) => c.scenarios.map((x) => x.id)),
    ...EXAMS.flatMap((e) => e.parts.map((x) => x.id)),
  ];
}
