import type { WritingPrompt } from "@/lib/writing/types";
import { writingPromptProblems } from "@/lib/writing/validate";
import dailyPerfectWeekend from "./prompts/daily-perfect-weekend.json";
import dailyMorningCommute from "./prompts/daily-morning-commute.json";
import dailyPlaceInMyCity from "./prompts/daily-place-in-my-city.json";
import emailFormalLostLibraryBook from "./prompts/email-formal-lost-library-book.json";
import emailFormalRefundRequest from "./prompts/email-formal-refund-request.json";
import emailFormalInternshipInquiry from "./prompts/email-formal-internship-inquiry.json";
import emailInformalInviteFriend from "./prompts/email-informal-invite-friend.json";
import emailInformalThankHostFamily from "./prompts/email-informal-thank-host-family.json";
import emailInformalAdviceNewStudent from "./prompts/email-informal-advice-new-student.json";
import opinionSchoolUniforms from "./prompts/opinion-school-uniforms.json";
import opinionPartTimeJobs from "./prompts/opinion-part-time-jobs.json";
import opinionOnlineClasses from "./prompts/opinion-online-classes.json";
import chartCommuteMethods from "./prompts/chart-commute-methods.json";
import chartScreenTime from "./prompts/chart-screen-time.json";
import chartRecyclingRates from "./prompts/chart-recycling-rates.json";
import storyWrongTrain from "./prompts/story-wrong-train.json";
import storyFirstThanksgiving from "./prompts/story-first-thanksgiving.json";
import storySnowstormNight from "./prompts/story-snowstorm-night.json";
import campusLeaveSickDay from "./prompts/campus-leave-sick-day.json";
import campusLeaveMissedLab from "./prompts/campus-leave-missed-lab.json";
import campusLeaveExtension from "./prompts/campus-leave-extension.json";
import campusProfessorOfficeHours from "./prompts/campus-professor-office-hours.json";
import campusProfessorAssignmentQuestion from "./prompts/campus-professor-assignment-question.json";
import campusProfessorRecommendation from "./prompts/campus-professor-recommendation.json";
import campusHousingRoomViewing from "./prompts/campus-housing-room-viewing.json";
import campusHousingHeatingRepair from "./prompts/campus-housing-heating-repair.json";
import campusHousingRoommateAgreement from "./prompts/campus-housing-roommate-agreement.json";
import ieltsTask1BottledTeaProcess from "./prompts/ielts-task1-bottled-tea-process.json";
import ieltsTask1CommuteModes from "./prompts/ielts-task1-commute-modes.json";
import ieltsTask1LibraryServices from "./prompts/ielts-task1-library-services.json";
import ieltsTask2QuietPublicSpaces from "./prompts/ielts-task2-quiet-public-spaces.json";
import ieltsTask2RepairOrReplace from "./prompts/ielts-task2-repair-or-replace.json";
import ieltsTask2StreetFoodMarkets from "./prompts/ielts-task2-street-food-markets.json";
import toeflGroupOrSoloProjects from "./prompts/toefl-group-or-solo-projects.json";
import toeflDiningHallFoodWaste from "./prompts/toefl-dining-hall-food-waste.json";
import toeflGreenRoofsOrStreetTrees from "./prompts/toefl-green-roofs-or-street-trees.json";
import geptEssaySkillFromFamily from "./prompts/gept-essay-skill-from-family.json";
import geptLetterBrokenElevator from "./prompts/gept-letter-broken-elevator.json";
import geptLetterThankHostFamily from "./prompts/gept-letter-thank-host-family.json";
import gsatEssayDayWithoutPhone from "./prompts/gsat-essay-day-without-phone.json";
import gsatPictureRainyBusStop from "./prompts/gsat-picture-rainy-bus-stop.json";
import gsatEssayGraduationTrip from "./prompts/gsat-essay-graduation-trip.json";

/**
 * Every official writing prompt (D187), in library order. Imported
 * statically so the JSON ships with the build, and validated at import:
 * a published prompt with problems fails the build. tests/writing-prompts
 * checks that every JSON file in prompts/ is listed here.
 */
const all = [
  dailyPerfectWeekend,
  dailyMorningCommute,
  dailyPlaceInMyCity,
  emailFormalLostLibraryBook,
  emailFormalRefundRequest,
  emailFormalInternshipInquiry,
  emailInformalInviteFriend,
  emailInformalThankHostFamily,
  emailInformalAdviceNewStudent,
  opinionSchoolUniforms,
  opinionPartTimeJobs,
  opinionOnlineClasses,
  chartCommuteMethods,
  chartScreenTime,
  chartRecyclingRates,
  storyWrongTrain,
  storyFirstThanksgiving,
  storySnowstormNight,
  campusLeaveSickDay,
  campusLeaveMissedLab,
  campusLeaveExtension,
  campusProfessorOfficeHours,
  campusProfessorAssignmentQuestion,
  campusProfessorRecommendation,
  campusHousingRoomViewing,
  campusHousingHeatingRepair,
  campusHousingRoommateAgreement,
  ieltsTask1BottledTeaProcess,
  ieltsTask1CommuteModes,
  ieltsTask1LibraryServices,
  ieltsTask2QuietPublicSpaces,
  ieltsTask2RepairOrReplace,
  ieltsTask2StreetFoodMarkets,
  toeflGroupOrSoloProjects,
  toeflDiningHallFoodWaste,
  toeflGreenRoofsOrStreetTrees,
  geptEssaySkillFromFamily,
  geptLetterBrokenElevator,
  geptLetterThankHostFamily,
  gsatEssayDayWithoutPhone,
  gsatPictureRainyBusStop,
  gsatEssayGraduationTrip,
] as unknown as WritingPrompt[];

for (const prompt of all) {
  const problems = writingPromptProblems(prompt);
  if (problems.length) {
    throw new Error(
      `data/writing/prompts/${prompt.id}.json: ${problems.join(", ")}`,
    );
  }
}

/** Every prompt, drafts included (the timing-style admin views). */
export const allWritingPrompts: readonly WritingPrompt[] = all;

/** The published prompts. */
export const writingPrompts: readonly WritingPrompt[] = all.filter(
  (p) => !p.draft,
);

export function getWritingPrompt(id: string): WritingPrompt | undefined {
  return writingPrompts.find((p) => p.id === id);
}
