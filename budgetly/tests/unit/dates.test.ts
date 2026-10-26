import { describe, expect, it } from "vitest";
import { addMonths, daysInMonth, diffDays, endOfMonth, isValidISODate, nextOccurrence, occurrencesBetween, startOfWeek, today } from "@/lib/dates";

describe("dates calendaires", () => {
  it("borne les fins de mois", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
  it("conserve le jour d'ancrage sur plusieurs mois", () => {
    const occ = occurrencesBetween("2026-01-31", "monthly", "2026-01-01", "2026-05-31");
    expect(occ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });
  it("respecte la date de fin et le début de fenêtre", () => {
    expect(occurrencesBetween("2026-01-05", "weekly", "2026-01-10", "2026-02-01", "2026-01-26")).toEqual(["2026-01-12", "2026-01-19", "2026-01-26"]);
  });
  it("fréquences trimestrielle et annuelle", () => {
    expect(nextOccurrence("2026-11-30", "quarterly")).toBe("2027-02-28");
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-02-28");
  });
  it("utilitaires", () => {
    expect(daysInMonth("2026-02-10")).toBe(28);
    expect(endOfMonth("2026-04-03")).toBe("2026-04-30");
    expect(diffDays("2026-03-30", "2026-03-28")).toBe(2);
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
  });
  it("date du jour dans le fuseau Europe/Paris", () => {
    expect(today("Europe/Paris", new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
});
