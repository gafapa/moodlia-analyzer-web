import { afterEach, describe, expect, it, vi } from "vitest";

import { generateCourseReport, generateStudentReport } from "../src/analysis/reportAgent";
import type { AiSettings, CourseAnalysis, StudentAnalysis } from "../src/types";

const settings: AiSettings = {
  provider: "custom",
  baseUrl: "https://ai.example.test",
  model: "test-model",
  apiKey: "session-secret",
};

function analysisFixture(): { analysis: CourseAnalysis; student: StudentAnalysis } {
  const student = {
    id: 42,
    fullname: "Sensitive Student Name",
    email: "sensitive@example.test",
    riskLevel: "high",
    riskFactors: ["Low activity"],
    recommendations: ["Review the course plan"],
    prediction: { predictedGrade: 3, predictedGradePct: 30, riskProbability: 0.8, method: "heuristic" },
    metrics: {
      finalGradePct: 35,
      engagementScore: 20,
      completionRate: 25,
      submissionRate: 30,
      lastAccessLabel: "10 days ago",
    },
  } as unknown as StudentAnalysis;

  const analysis = {
    course: { id: 7, fullname: "Sensitive Course Name" },
    students: [student],
    courseMetrics: { totalStudents: 1 },
    teacherRecommendations: ["Contact students at high risk"],
    passThresholdPct: 50,
  } as unknown as CourseAnalysis;

  return { analysis, student };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("report agent privacy and transport", () => {
  it("sends course statistics without student or course names", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body);
      expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer session-secret");
      return new Response(JSON.stringify({ choices: [{ message: { content: "Report" } }] }), { status: 200 });
    }));

    const { analysis } = analysisFixture();
    await expect(generateCourseReport(analysis, settings, "en")).resolves.toBe("Report");

    expect(requestBody).toContain('\\"studentId\\": 42');
    expect(requestBody).not.toContain("Sensitive Student Name");
    expect(requestBody).not.toContain("sensitive@example.test");
    expect(requestBody).not.toContain("Sensitive Course Name");
  });

  it("uses only the student ID in an individual report", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Student report" } }] }), { status: 200 });
    }));

    const { analysis, student } = analysisFixture();
    await generateStudentReport(analysis, student, settings, "en");

    expect(requestBody).toContain('\\"id\\": 42');
    expect(requestBody).not.toContain("Sensitive Student Name");
    expect(requestBody).not.toContain("sensitive@example.test");
  });

  it("rejects insecure remote AI endpoints before sending the API key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { analysis } = analysisFixture();

    await expect(generateCourseReport(analysis, { ...settings, baseUrl: "http://ai.example.test" }, "en"))
      .rejects.toThrow(/HTTPS/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
