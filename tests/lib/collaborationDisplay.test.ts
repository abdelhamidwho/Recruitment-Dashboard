import { describe, expect, it } from "vitest";
import { summarizeViewers, summarizePipeline } from "@/lib/collaborationDisplay";

describe("summarizeViewers", () => {
  const me = "user-me";

  it("no one has viewed", () => {
    expect(summarizeViewers([], me)).toBe("Not viewed yet");
  });

  it("only the current user has viewed", () => {
    expect(summarizeViewers([{ userId: me, name: "Me" }], me)).toBe("Viewed by you");
  });

  it("one other person has viewed", () => {
    expect(summarizeViewers([{ userId: "u1", name: "Sara" }], me)).toBe("Viewed by Sara");
  });

  it("one other person and me", () => {
    expect(
      summarizeViewers(
        [
          { userId: "u1", name: "Sara" },
          { userId: me, name: "Me" },
        ],
        me,
      ),
    ).toBe("Viewed by Sara and you");
  });

  it("two others, not me", () => {
    expect(
      summarizeViewers(
        [
          { userId: "u1", name: "Sara" },
          { userId: "u2", name: "Ken" },
        ],
        me,
      ),
    ).toBe("Viewed by Sara and Ken");
  });

  it("three or more others summarize with a +N count", () => {
    expect(
      summarizeViewers(
        [
          { userId: "u1", name: "Sara" },
          { userId: "u2", name: "Ken" },
          { userId: "u3", name: "Lee" },
        ],
        me,
      ),
    ).toBe("Viewed by Sara +2 more");
  });

  it("three or more others plus me", () => {
    expect(
      summarizeViewers(
        [
          { userId: "u1", name: "Sara" },
          { userId: "u2", name: "Ken" },
          { userId: "u3", name: "Lee" },
          { userId: me, name: "Me" },
        ],
        me,
      ),
    ).toBe("Viewed by Sara +2 more and you");
  });
});

describe("summarizePipeline", () => {
  it("no jobs -> null", () => {
    expect(summarizePipeline([])).toBeNull();
  });

  it("one job -> its stage", () => {
    expect(summarizePipeline([{ jobId: "j1", jobTitle: "Eng", stage: "Interview" }])).toBe("Interview");
  });

  it("multiple jobs -> a count summary", () => {
    expect(
      summarizePipeline([
        { jobId: "j1", jobTitle: "Eng", stage: "Interview" },
        { jobId: "j2", jobTitle: "PM", stage: "Sourced" },
      ]),
    ).toBe("2 pipelines");
  });
});
