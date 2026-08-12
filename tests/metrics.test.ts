import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudentMetricsComputer } from '../src/analysis/metrics';
import type { StudentCourseData } from '../src/types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StudentMetricsComputer', () => {
  it('computes academic, activity, timing, and engagement metrics', () => {
    const now = 1_800_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
    const student: StudentCourseData = {
      id: 7,
      fullname: 'Student',
      lastaccess: now - 2 * 86400,
      grades: {
        finalGrade: 8,
        finalGradePct: 80,
        courseTotalMax: 10,
        items: [
          { name: 'Task 1', grade: 6, gradePct: 60, maxGrade: 10, minGrade: 0, gradedAt: now - 20_000 },
          { name: 'Task 2', grade: 9, gradePct: 90, maxGrade: 10, minGrade: 0, gradedAt: now - 10_000 }
        ]
      },
      completion: { statuses: [], completed: 3, total: 4 },
      submissions: [{ assignid: 1, status: 'submitted', timemodified: now - 1_000 }],
      quizAttempts: [{ quizid: 2, state: 'finished', grade: 8, timestart: now - 600, timefinish: now }],
      forumPosts: [{ discussionid: 5, parent: 0, created: now - 5_000 }],
      logs: [
        { timecreated: now - 8_000 },
        { timecreated: now - 7_700 },
        { timecreated: now - 1_000 }
      ]
    };
    const metrics = new StudentMetricsComputer(student, {
      assignments: [{ id: 1, duedate: now - 2_000 }],
      quizzes: [{ id: 2, grade: 10 }],
      forums: [{ id: 5 }]
    }).compute();

    expect(metrics.daysSinceAccess).toBe(2);
    expect(metrics.gradeAvgPct).toBe(75);
    expect(metrics.gradeTrend).toBe('improving');
    expect(metrics.completionRate).toBe(75);
    expect(metrics.submissionRate).toBe(100);
    expect(metrics.lateSubmissions).toBe(1);
    expect(metrics.quizAvgPct).toBe(80);
    expect(metrics.quizCoverageRate).toBe(100);
    expect(metrics.forumDiscussionsStarted).toBe(1);
    expect(metrics.sessionCount).toBe(2);
    expect(metrics.quizAvgTimeMin).toBe(10);
    expect(metrics.academicScore).toBeCloseTo((80 + 75 + 80) / 3);
    expect(metrics.engagementScore).toBeGreaterThan(0);
    expect(metrics.engagementScore).toBeLessThanOrEqual(100);
  });

  it('handles courses without optional activities without inventing rates', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const metrics = new StudentMetricsComputer({
      id: 8,
      fullname: 'Student',
      grades: { finalGrade: null, finalGradePct: null, courseTotalMax: null, items: [] },
      completion: { statuses: [], completed: 0, total: 0 },
      submissions: [],
      quizAttempts: [],
      forumPosts: [],
      logs: []
    }, { assignments: [], quizzes: [], forums: [] }).compute();

    expect(metrics.completionRate).toBeNull();
    expect(metrics.submissionRate).toBeNull();
    expect(metrics.quizCoverageRate).toBeNull();
    expect(metrics.sessionCount).toBeNull();
    expect(metrics.academicScore).toBe(0);
  });
});
