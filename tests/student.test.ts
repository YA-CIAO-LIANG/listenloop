import { describe, expect, it } from "vitest";
import {
  isStudentEmail,
  STUDENT_VERIFICATION_DAYS,
  studentStatus,
} from "@/lib/student";

/** The student plan's verification (D144). */
describe("school emails", () => {
  it("are .edu, .edu.tw and other school domains, any case", () => {
    for (const email of [
      "amy@ntu.edu.tw",
      "b10901001@ntu.edu.tw",
      "x@g.ntu.edu.tw",
      "bob@stanford.edu",
      "BOB@MIT.EDU",
      "s@ucl.ac.uk",
      "s@student.unimelb.edu.au",
      "s@mail.utoronto.ca",
      "s@u.ac.jp",
    ]) {
      expect(isStudentEmail(email), email).toBe(true);
    }
  });

  it("aren't personal addresses or look-alikes", () => {
    for (const email of [
      "joe@gmail.com",
      "a@edu.tw", // the suffix alone isn't a school
      "a@edu",
      "a@education.com",
      "a@school.edu.tw.evil.com",
      "a@toronto.ca",
      "",
      null,
      undefined,
      "no-at-sign.edu",
    ]) {
      expect(isStudentEmail(email), String(email)).toBe(false);
    }
  });
});

describe("studentStatus", () => {
  const now = new Date("2026-11-12T00:00:00Z");
  it("is verified for a year from the last school sign-in, then expired", () => {
    expect(studentStatus(null, now)).toEqual({ state: "none" });
    expect(studentStatus("2026-01-01T00:00:00Z", now)).toEqual({
      state: "verified",
      until: "2027-01-01T00:00:00.000Z",
    });
    const yearAgo = new Date(
      now.getTime() - STUDENT_VERIFICATION_DAYS * 86_400_000,
    ).toISOString();
    expect(studentStatus(yearAgo, now).state).toBe("expired");
    expect(studentStatus("not a date", now)).toEqual({ state: "none" });
  });
});
