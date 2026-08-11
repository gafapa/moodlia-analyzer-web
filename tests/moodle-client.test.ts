import { afterEach, describe, expect, it, vi } from 'vitest';

import { MoodleApiError, MoodleClient } from '../src/api/moodleClient';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MoodleClient', () => {
  it('authenticates with credentials and initializes site identity', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith('/login/token.php')) {
        return new Response(JSON.stringify({ token: 'rest-token' }), { status: 200 });
      }
      return new Response(JSON.stringify({ sitename: 'Campus', userid: 9, fullname: 'Teacher' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = await MoodleClient.fromCredentials('https://example.test/moodle/', 'teacher', 'password');

    expect(client.baseUrl).toBe('https://example.test/moodle');
    expect(client.token).toBe('rest-token');
    expect(client.siteName).toBe('Campus');
    expect(client.userId).toBe(9);
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe('https://example.test/moodle/login/token.php');
    expect(String(requests[0].init?.body)).toContain('service=moodle_mobile_app');
    const siteBody = new URLSearchParams(String(requests[1].init?.body));
    expect(siteBody.get('wsfunction')).toBe('core_webservice_get_site_info');
    expect(siteBody.get('wstoken')).toBe('rest-token');
  });

  it('flattens nested Moodle parameters into form fields', async () => {
    let body = new URLSearchParams();
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      body = new URLSearchParams(String(init?.body));
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const client = new MoodleClient('https://example.test', 'token');

    await client.getCourseUserProfiles(4, [11, 12]);

    expect(body.get('wsfunction')).toBe('core_user_get_course_user_profiles');
    expect(body.get('courseid')).toBe('4');
    expect(body.get('userids[0]')).toBe('11');
    expect(body.get('userids[1]')).toBe('12');
  });

  it('surfaces Moodle exceptions from required API calls', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      exception: 'required_capability_exception',
      message: 'Missing capability'
    }), { status: 200 })));

    await expect(new MoodleClient('https://example.test', 'token').getAttemptReview(7))
      .rejects.toThrow(new MoodleApiError('API [mod_quiz_get_attempt_review]: Missing capability'));
  });

  it('returns safe fallbacks for optional endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network blocked'); }));
    const client = new MoodleClient('https://example.test', 'token');

    await expect(client.getAssignments(4)).resolves.toEqual([]);
    await expect(client.getEnrollmentCount(4)).resolves.toBe(0);
  });
});
