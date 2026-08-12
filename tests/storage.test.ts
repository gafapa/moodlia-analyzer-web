import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteProfile,
  loadAiSettings,
  loadLanguage,
  loadProfiles,
  saveDashboardPreferences,
  upsertProfile
} from '../src/lib/storage';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

describe('storage', () => {
  it('creates, replaces, sorts, and deletes connection profiles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    upsertProfile({ name: 'Older', url: 'https://one.test', token: 'one' });
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    upsertProfile({ name: 'Newer', url: 'https://two.test', token: 'two' });
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    upsertProfile({ name: 'Older', url: 'https://updated.test', token: 'updated' });

    expect(loadProfiles().map((profile) => profile.name)).toEqual(['Older', 'Newer']);
    expect(loadProfiles()[0].url).toBe('https://updated.test');
    expect(deleteProfile('Older').map((profile) => profile.name)).toEqual(['Newer']);
    vi.useRealTimers();
  });

  it('falls back safely for corrupt or unsupported stored values', () => {
    window.localStorage.setItem('moodle-analyzer-web:language', 'fr');
    window.localStorage.setItem('moodle-analyzer-web:ai-settings', '{broken');
    expect(loadLanguage()).toBe('en');
    expect(loadAiSettings()).toEqual({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: '', apiKey: '' });
  });

  it('merges dashboard preferences without losing earlier choices', () => {
    expect(saveDashboardPreferences('course-1', { activeTab: 'risk' })).toEqual({ activeTab: 'risk' });
    expect(saveDashboardPreferences('course-1', { studentSort: 'grade' })).toEqual({ activeTab: 'risk', studentSort: 'grade' });
  });
});
