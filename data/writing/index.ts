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
import capAHelpfulClassmate from "./prompts/cap-a-helpful-classmate.json";
import capCookingForMyFamily from "./prompts/cap-cooking-for-my-family.json";
import capSummerVacationPlan from "./prompts/cap-summer-vacation-plan.json";
import dailyCommunityHelper from "./prompts/daily-community-helper.json";
import dailyFavoriteFoodStall from "./prompts/daily-favorite-food-stall.json";
import dailyHabitToBuild from "./prompts/daily-habit-to-build.json";
import dailyLunarNewYear from "./prompts/daily-lunar-new-year.json";
import dailyMyDesk from "./prompts/daily-my-desk.json";
import diaryConversationChangedMind from "./prompts/diary-conversation-changed-mind.json";
import diaryDayWentWrong from "./prompts/diary-day-went-wrong.json";
import diaryFirstWeekNewPlace from "./prompts/diary-first-week-new-place.json";
import diaryRainyDayAtHome from "./prompts/diary-rainy-day-at-home.json";
import diarySmallWinToday from "./prompts/diary-small-win-today.json";
import geptEssayUsefulApp from "./prompts/gept-essay-useful-app.json";
import gsatEssayNewSchoolSubject from "./prompts/gsat-essay-new-school-subject.json";
import gsatPictureTurtleOnTheBeach from "./prompts/gsat-picture-turtle-on-the-beach.json";
import ieltsTask1MuseumVisitors from "./prompts/ielts-task1-museum-visitors.json";
import ieltsTask2OnlineShoppingHighStreets from "./prompts/ielts-task2-online-shopping-high-streets.json";
import toeflCoursesOutsideMajor from "./prompts/toefl-courses-outside-major.json";
import toeicEmailCateringOrder from "./prompts/toeic-email-catering-order.json";
import toeicEmailSoftwareTraining from "./prompts/toeic-email-software-training.json";
import toeicOpinionPromoteFromWithin from "./prompts/toeic-opinion-promote-from-within.json";
import campusHousingDepositDispute from "./prompts/campus-housing-deposit-dispute.json";
import campusHousingNoisyNeighbor from "./prompts/campus-housing-noisy-neighbor.json";
import campusHousingRoomTransfer from "./prompts/campus-housing-room-transfer.json";
import campusLeaveCompassionateLeave from "./prompts/campus-leave-compassionate-leave.json";
import campusLeaveFamilyWedding from "./prompts/campus-leave-family-wedding.json";
import campusLeaveSportsCompetition from "./prompts/campus-leave-sports-competition.json";
import campusProfessorGradeFeedback from "./prompts/campus-professor-grade-feedback.json";
import campusProfessorResearchAssistant from "./prompts/campus-professor-research-assistant.json";
import campusProfessorTextbookEdition from "./prompts/campus-professor-textbook-edition.json";
import capAVisitToGrandparents from "./prompts/cap-a-visit-to-grandparents.json";
import capLearningANewHobby from "./prompts/cap-learning-a-new-hobby.json";
import capMyDreamJob from "./prompts/cap-my-dream-job.json";
import capMyFavoriteSeason from "./prompts/cap-my-favorite-season.json";
import capSchoolSportsDay from "./prompts/cap-school-sports-day.json";
import chartBreakfastChoices from "./prompts/chart-breakfast-choices.json";
import chartFavoriteSports from "./prompts/chart-favorite-sports.json";
import chartReadingFormats from "./prompts/chart-reading-formats.json";
import diaryFirstPartTimeShift from "./prompts/diary-first-part-time-shift.json";
import emailFormalExchangeApplication from "./prompts/email-formal-exchange-application.json";
import emailFormalJoinSchoolClub from "./prompts/email-formal-join-school-club.json";
import emailFormalNoiseComplaint from "./prompts/email-formal-noise-complaint.json";
import emailInformalMissedBirthday from "./prompts/email-informal-missed-birthday.json";
import emailInformalNewPuppy from "./prompts/email-informal-new-puppy.json";
import emailInformalTaiwanVisitPlans from "./prompts/email-informal-taiwan-visit-plans.json";
import geptEssayLessPlasticAtHome from "./prompts/gept-essay-less-plastic-at-home.json";
import geptEssayMemorableClassTrip from "./prompts/gept-essay-memorable-class-trip.json";
import geptEssayMistakeILearnedFrom from "./prompts/gept-essay-mistake-i-learned-from.json";
import geptHiEssayAiHomeworkRules from "./prompts/gept-hi-essay-ai-homework-rules.json";
import geptHiEssayFourDayWeek from "./prompts/gept-hi-essay-four-day-week.json";
import geptHiEssayGapYear from "./prompts/gept-hi-essay-gap-year.json";
import geptHiEssayNewsOnSocialMedia from "./prompts/gept-hi-essay-news-on-social-media.json";
import geptHiEssayTouristsSmallTowns from "./prompts/gept-hi-essay-tourists-small-towns.json";
import geptHiLetterAdviseCousinMajor from "./prompts/gept-hi-letter-advise-cousin-major.json";
import geptHiLetterSaferSidewalks from "./prompts/gept-hi-letter-safer-sidewalks.json";
import geptHiLetterVolunteerApplication from "./prompts/gept-hi-letter-volunteer-application.json";
import geptLetterInviteLanternFestival from "./prompts/gept-letter-invite-lantern-festival.json";
import geptPicBeachCleanup from "./prompts/gept-pic-beach-cleanup.json";
import geptPicLostWallet from "./prompts/gept-pic-lost-wallet.json";
import geptPicMoonFestivalBarbecue from "./prompts/gept-pic-moon-festival-barbecue.json";
import geptPicNightMarketDinner from "./prompts/gept-pic-night-market-dinner.json";
import geptPicSeatOnTheMrt from "./prompts/gept-pic-seat-on-the-mrt.json";
import geptPicSharingAnUmbrella from "./prompts/gept-pic-sharing-an-umbrella.json";
import geptPicSportsDayRelay from "./prompts/gept-pic-sports-day-relay.json";
import geptPicTyphoonDayAtHome from "./prompts/gept-pic-typhoon-day-at-home.json";
import gsatEssayConvenienceStores from "./prompts/gsat-essay-convenience-stores.json";
import gsatEssayLearningFromFailure from "./prompts/gsat-essay-learning-from-failure.json";
import gsatPictureWalletOnTheMrt from "./prompts/gsat-picture-wallet-on-the-mrt.json";
import ieltsTask1CarSalesByFuel from "./prompts/ielts-task1-car-sales-by-fuel.json";
import ieltsTask1HouseholdWaterUse from "./prompts/ielts-task1-household-water-use.json";
import ieltsTask1RainwaterCollection from "./prompts/ielts-task1-rainwater-collection.json";
import ieltsTask1WeekendActivities from "./prompts/ielts-task1-weekend-activities.json";
import ieltsTask2EarlyForeignLanguages from "./prompts/ielts-task2-early-foreign-languages.json";
import ieltsTask2FourDayWorkWeek from "./prompts/ielts-task2-four-day-work-week.json";
import ieltsTask2LivingAlone from "./prompts/ielts-task2-living-alone.json";
import ieltsTask2TouristOvercrowding from "./prompts/ielts-task2-tourist-overcrowding.json";
import opinionGapYear from "./prompts/opinion-gap-year.json";
import opinionPhonesInClass from "./prompts/opinion-phones-in-class.json";
import opinionWeekendHomework from "./prompts/opinion-weekend-homework.json";
import storyBorrowedCamera from "./prompts/story-borrowed-camera.json";
import storyMissingCat from "./prompts/story-missing-cat.json";
import storyNightMarketBlackout from "./prompts/story-night-market-blackout.json";
import toeflAiToolsForCoursework from "./prompts/toefl-ai-tools-for-coursework.json";
import toeflFourDayWorkWeek from "./prompts/toefl-four-day-work-week.json";
import toeflIntegratedBikeSharing from "./prompts/toefl-integrated-bike-sharing.json";
import toeflIntegratedFourDaySchoolWeek from "./prompts/toefl-integrated-four-day-school-week.json";
import toeflIntegratedMammothRevival from "./prompts/toefl-integrated-mammoth-revival.json";
import toeflIntegratedMayaDrought from "./prompts/toefl-integrated-maya-drought.json";
import toeflIntegratedOnlineCourses from "./prompts/toefl-integrated-online-courses.json";
import toeflIntegratedOpenPlanOffices from "./prompts/toefl-integrated-open-plan-offices.json";
import toeflIntegratedRooftopBeehives from "./prompts/toefl-integrated-rooftop-beehives.json";
import toeflIntegratedTreePlantingOffsets from "./prompts/toefl-integrated-tree-planting-offsets.json";
import toeflLocalOrWorldHistory from "./prompts/toefl-local-or-world-history.json";
import toeflZoosAndConservation from "./prompts/toefl-zoos-and-conservation.json";
import toeicEmailConferenceSpeaker from "./prompts/toeic-email-conference-speaker.json";
import toeicEmailFitnessMembership from "./prompts/toeic-email-fitness-membership.json";
import toeicEmailOfficeMove from "./prompts/toeic-email-office-move.json";
import toeicOpinionOfficeDressCode from "./prompts/toeic-opinion-office-dress-code.json";
import toeicOpinionSmallOrLargeCompany from "./prompts/toeic-opinion-small-or-large-company.json";

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
  dailyCommunityHelper,
  dailyFavoriteFoodStall,
  dailyHabitToBuild,
  dailyLunarNewYear,
  dailyMyDesk,
  diaryConversationChangedMind,
  diaryDayWentWrong,
  diaryFirstWeekNewPlace,
  diaryRainyDayAtHome,
  diarySmallWinToday,
  diaryFirstPartTimeShift,
  emailFormalLostLibraryBook,
  emailFormalRefundRequest,
  emailFormalInternshipInquiry,
  emailFormalExchangeApplication,
  emailFormalJoinSchoolClub,
  emailFormalNoiseComplaint,
  emailInformalInviteFriend,
  emailInformalThankHostFamily,
  emailInformalAdviceNewStudent,
  emailInformalMissedBirthday,
  emailInformalNewPuppy,
  emailInformalTaiwanVisitPlans,
  opinionSchoolUniforms,
  opinionPartTimeJobs,
  opinionOnlineClasses,
  opinionGapYear,
  opinionPhonesInClass,
  opinionWeekendHomework,
  chartCommuteMethods,
  chartScreenTime,
  chartRecyclingRates,
  chartBreakfastChoices,
  chartFavoriteSports,
  chartReadingFormats,
  storyWrongTrain,
  storyFirstThanksgiving,
  storySnowstormNight,
  storyBorrowedCamera,
  storyMissingCat,
  storyNightMarketBlackout,
  campusLeaveSickDay,
  campusLeaveMissedLab,
  campusLeaveExtension,
  campusLeaveCompassionateLeave,
  campusLeaveFamilyWedding,
  campusLeaveSportsCompetition,
  campusProfessorOfficeHours,
  campusProfessorAssignmentQuestion,
  campusProfessorRecommendation,
  campusProfessorGradeFeedback,
  campusProfessorResearchAssistant,
  campusProfessorTextbookEdition,
  campusHousingRoomViewing,
  campusHousingHeatingRepair,
  campusHousingRoommateAgreement,
  campusHousingDepositDispute,
  campusHousingNoisyNeighbor,
  campusHousingRoomTransfer,
  ieltsTask1BottledTeaProcess,
  ieltsTask1CommuteModes,
  ieltsTask1LibraryServices,
  ieltsTask1MuseumVisitors,
  ieltsTask1CarSalesByFuel,
  ieltsTask1HouseholdWaterUse,
  ieltsTask1RainwaterCollection,
  ieltsTask1WeekendActivities,
  ieltsTask2QuietPublicSpaces,
  ieltsTask2RepairOrReplace,
  ieltsTask2StreetFoodMarkets,
  ieltsTask2OnlineShoppingHighStreets,
  ieltsTask2EarlyForeignLanguages,
  ieltsTask2FourDayWorkWeek,
  ieltsTask2LivingAlone,
  ieltsTask2TouristOvercrowding,
  toeflGroupOrSoloProjects,
  toeflDiningHallFoodWaste,
  toeflGreenRoofsOrStreetTrees,
  toeflCoursesOutsideMajor,
  toeflAiToolsForCoursework,
  toeflFourDayWorkWeek,
  toeflLocalOrWorldHistory,
  toeflZoosAndConservation,
  toeflIntegratedBikeSharing,
  toeflIntegratedFourDaySchoolWeek,
  toeflIntegratedMammothRevival,
  toeflIntegratedMayaDrought,
  toeflIntegratedOnlineCourses,
  toeflIntegratedOpenPlanOffices,
  toeflIntegratedRooftopBeehives,
  toeflIntegratedTreePlantingOffsets,
  geptEssaySkillFromFamily,
  geptLetterBrokenElevator,
  geptLetterThankHostFamily,
  geptEssayUsefulApp,
  geptEssayLessPlasticAtHome,
  geptEssayMemorableClassTrip,
  geptEssayMistakeILearnedFrom,
  geptHiEssayAiHomeworkRules,
  geptHiEssayFourDayWeek,
  geptHiEssayGapYear,
  geptHiEssayNewsOnSocialMedia,
  geptHiEssayTouristsSmallTowns,
  geptHiLetterAdviseCousinMajor,
  geptHiLetterSaferSidewalks,
  geptHiLetterVolunteerApplication,
  geptLetterInviteLanternFestival,
  geptPicBeachCleanup,
  geptPicLostWallet,
  geptPicMoonFestivalBarbecue,
  geptPicNightMarketDinner,
  geptPicSeatOnTheMrt,
  geptPicSharingAnUmbrella,
  geptPicSportsDayRelay,
  geptPicTyphoonDayAtHome,
  gsatEssayDayWithoutPhone,
  gsatPictureRainyBusStop,
  gsatEssayGraduationTrip,
  gsatEssayNewSchoolSubject,
  gsatPictureTurtleOnTheBeach,
  gsatEssayConvenienceStores,
  gsatEssayLearningFromFailure,
  gsatPictureWalletOnTheMrt,
  toeicEmailCateringOrder,
  toeicEmailSoftwareTraining,
  toeicOpinionPromoteFromWithin,
  toeicEmailConferenceSpeaker,
  toeicEmailFitnessMembership,
  toeicEmailOfficeMove,
  toeicOpinionOfficeDressCode,
  toeicOpinionSmallOrLargeCompany,
  capAHelpfulClassmate,
  capCookingForMyFamily,
  capSummerVacationPlan,
  capAVisitToGrandparents,
  capLearningANewHobby,
  capMyDreamJob,
  capMyFavoriteSeason,
  capSchoolSportsDay,
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
