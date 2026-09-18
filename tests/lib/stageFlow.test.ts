import { describe, expect, it } from "vitest";
import { nextStage, isTerminalStage, FORWARD_STAGES } from "@/lib/stageFlow";

describe("nextStage", () => {
  it("advances through the forward sequence", () => {
    expect(nextStage("Sourced")).toBe("Contacted");
    expect(nextStage("Contacted")).toBe("Screening");
    expect(nextStage("Screening")).toBe("Interview");
    expect(nextStage("Interview")).toBe("Offer");
    expect(nextStage("Offer")).toBe("Hired");
  });

  it("returns null once Hired — nothing further to advance to", () => {
    expect(nextStage("Hired")).toBeNull();
  });

  it("returns null for Rejected — terminal, and not part of the forward sequence", () => {
    expect(nextStage("Rejected")).toBeNull();
    expect(FORWARD_STAGES).not.toContain("Rejected");
  });
});

describe("isTerminalStage", () => {
  it("Hired and Rejected are terminal", () => {
    expect(isTerminalStage("Hired")).toBe(true);
    expect(isTerminalStage("Rejected")).toBe(true);
  });

  it("everything else is not", () => {
    expect(isTerminalStage("Sourced")).toBe(false);
    expect(isTerminalStage("Offer")).toBe(false);
  });
});
