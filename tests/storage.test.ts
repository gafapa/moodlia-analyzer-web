import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteProfile,
  loadAiSettings,
  loadLanguage,
  loadProfiles,
  saveAiSettings,
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

class BlockedStorage {
  getItem(): never { throw new DOMException('Blocked', 'SecurityError'); }
  setItem(): never { throw new DOMException('Blocked', 'SecurityError'); }
  removeItem(): never { throw new DOMException('Blocked', 'SecurityError'); }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() });
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
    expect(loadProfiles()[0].token).toBe('updated');
    const persistedProfiles = JSON.parse(window.localStorage.getItem('moodle-analyzer-web:profiles') || '[]');
    expect(persistedProfiles.every((profile: Record<string, unknown>) => !Object.hasOwn(profile, 'token'))).toBe(true);
    expect(deleteProfile('Older').map((profile) => profile.name)).toEqual(['Newer']);
    vi.useRealTimers();
  });

  it('keeps AI API keys in session storage and migrates legacy local secrets', () => {
    saveAiSettings({ provider: 'custom', baseUrl: 'https://ai.example.test', model: 'model', apiKey: 'secret' });

    expect(loadAiSettings().apiKey).toBe('secret');
    expect(window.localStorage.getItem('moodle-analyzer-web:ai-settings')).not.toContain('secret');
    expect(window.sessionStorage.getItem('moodle-analyzer-web:ai-api-key')).toBe('secret');
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

  it('keeps working when browser storage is blocked', () => {
    vi.stubGlobal('window', { localStorage: new BlockedStorage(), sessionStorage: new BlockedStorage() });

    expect(() => upsertProfile({ name: 'Temporary', url: 'https://example.test', token: 'secret' })).not.toThrow();
    expect(saveAiSettings({ provider: 'custom', baseUrl: 'https://ai.example.test', model: 'model', apiKey: 'secret' }))
      .toEqual({ provider: 'custom', baseUrl: 'https://ai.example.test', model: 'model', apiKey: 'secret' });
    expect(loadProfiles()).toEqual([]);
  });
});
