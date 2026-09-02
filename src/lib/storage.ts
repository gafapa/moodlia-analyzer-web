import type { AiSettings, ConnectionProfile, LanguageCode } from "../types";

const PROFILES_KEY = "moodle-analyzer-web:profiles";
const PROFILE_TOKENS_KEY = "moodle-analyzer-web:profile-tokens";
const LANGUAGE_KEY = "moodle-analyzer-web:language";
const AI_SETTINGS_KEY = "moodle-analyzer-web:ai-settings";
const AI_API_KEY = "moodle-analyzer-web:ai-api-key";
const DASHBOARD_PREFS_KEY = "moodle-analyzer-web:dashboard-prefs";
const STUDENT_PREFS_KEY = "moodle-analyzer-web:student-prefs";
const RUNTIME_LOGS_KEY = "moodle-analyzer-web:runtime-logs";

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "ollama",
  baseUrl: "http://127.0.0.1:11434",
  model: "",
  apiKey: "",
};

export type DashboardPreferences = {
  activeTab?: string;
  overviewSubtab?: string;
  riskSubtab?: string;
  activitySubtab?: string;
  trendsSubtab?: string;
  interventionSubtab?: string;
  studentQuery?: string;
  studentSort?: string;
  studentFilter?: string;
};

export type StudentPreferences = {
  activeTab?: string;
  overviewSubtab?: string;
  activitySubtab?: string;
  assessmentsSubtab?: string;
};

export type RuntimeLogEntry = {
  id: string;
  scope: "connection" | "analysis" | "ai" | "ui";
  message: string;
  detail?: string;
  at: string;
};

type PreferencesMap<T> = Record<string, T>;
type StoredConnectionProfile = Omit<ConnectionProfile, "token"> & { token?: string };

function withoutToken(profile: ConnectionProfile): Omit<ConnectionProfile, "token"> {
  return {
    name: profile.name,
    url: profile.url,
    username: profile.username,
    lastUsed: profile.lastUsed,
  };
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Continue with in-memory state when persistent browser storage is unavailable.
  }
}

function safeSessionRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSessionWrite<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in hardened or private browser contexts.
  }
}

function safeSessionGetItem(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSetItem(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Keep the active in-memory settings even when browser storage is unavailable.
  }
}

function safeSessionRemoveItem(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // There is nothing else to remove when storage is unavailable.
  }
}

export function loadProfiles(): ConnectionProfile[] {
  const storedProfiles = safeRead<StoredConnectionProfile[]>(PROFILES_KEY, []);
  const sessionTokens = safeSessionRead<Record<string, string>>(PROFILE_TOKENS_KEY, {});
  let migrated = false;

  const profiles = storedProfiles.map((profile) => {
    if (profile.token) {
      sessionTokens[profile.name] = profile.token;
      migrated = true;
    }
    return {
      name: profile.name,
      url: profile.url,
      username: profile.username,
      lastUsed: profile.lastUsed,
      token: sessionTokens[profile.name] ?? "",
    };
  });

  if (migrated) {
    safeWrite(PROFILES_KEY, profiles.map(withoutToken));
    safeSessionWrite(PROFILE_TOKENS_KEY, sessionTokens);
  }

  return profiles.sort((left, right) => {
    return right.lastUsed.localeCompare(left.lastUsed);
  });
}

export function upsertProfile(profile: Omit<ConnectionProfile, "lastUsed">): ConnectionProfile[] {
  const profiles = loadProfiles();
  const next: ConnectionProfile = { ...profile, lastUsed: new Date().toISOString() };
  const index = profiles.findIndex((item) => item.name === profile.name);

  if (index >= 0) {
    profiles[index] = next;
  } else {
    profiles.push(next);
  }

  const sessionTokens = safeSessionRead<Record<string, string>>(PROFILE_TOKENS_KEY, {});
  if (profile.token) {
    sessionTokens[profile.name] = profile.token;
  } else {
    delete sessionTokens[profile.name];
  }
  safeSessionWrite(PROFILE_TOKENS_KEY, sessionTokens);
  safeWrite(PROFILES_KEY, profiles.map(withoutToken));
  return loadProfiles();
}

export function deleteProfile(name: string): ConnectionProfile[] {
  const profiles = loadProfiles().filter((profile) => profile.name !== name);
  const sessionTokens = safeSessionRead<Record<string, string>>(PROFILE_TOKENS_KEY, {});
  delete sessionTokens[name];
  safeSessionWrite(PROFILE_TOKENS_KEY, sessionTokens);
  safeWrite(PROFILES_KEY, profiles.map(withoutToken));
  return profiles;
}

export function loadLanguage(): LanguageCode {
  const language = safeRead<string>(LANGUAGE_KEY, "en");
  return language === "es" ? "es" : "en";
}

export function saveLanguage(language: LanguageCode): void {
  safeWrite(LANGUAGE_KEY, language);
}

export function loadAiSettings(): AiSettings {
  const stored = safeRead<Partial<AiSettings>>(AI_SETTINGS_KEY, {});
  if (stored.apiKey) {
    safeSessionSetItem(AI_API_KEY, stored.apiKey);
    safeWrite(AI_SETTINGS_KEY, {
      provider: stored.provider,
      baseUrl: stored.baseUrl,
      model: stored.model,
    });
  }
  return {
    ...DEFAULT_AI_SETTINGS,
    ...stored,
    apiKey: safeSessionGetItem(AI_API_KEY) ?? "",
  };
}

export function saveAiSettings(settings: AiSettings): AiSettings {
  const next = { ...DEFAULT_AI_SETTINGS, ...settings };
  const { apiKey, ...persistentSettings } = next;
  safeWrite(AI_SETTINGS_KEY, persistentSettings);
  if (apiKey) {
    safeSessionSetItem(AI_API_KEY, apiKey);
  } else {
    safeSessionRemoveItem(AI_API_KEY);
  }
  return next;
}

export function loadDashboardPreferences(courseKey: string): DashboardPreferences {
  const allPreferences = safeRead<PreferencesMap<DashboardPreferences>>(DASHBOARD_PREFS_KEY, {});
  return allPreferences[courseKey] ?? {};
}

export function saveDashboardPreferences(
  courseKey: string,
  nextPreferences: Partial<DashboardPreferences>,
): DashboardPreferences {
  const allPreferences = safeRead<PreferencesMap<DashboardPreferences>>(DASHBOARD_PREFS_KEY, {});
  const merged = {
    ...(allPreferences[courseKey] ?? {}),
    ...nextPreferences,
  };
  allPreferences[courseKey] = merged;
  safeWrite(DASHBOARD_PREFS_KEY, allPreferences);
  return merged;
}

export function loadStudentPreferences(courseKey: string, studentId: number): StudentPreferences {
  const allPreferences = safeRead<PreferencesMap<StudentPreferences>>(STUDENT_PREFS_KEY, {});
  return allPreferences[`${courseKey}:${studentId}`] ?? {};
}

export function saveStudentPreferences(
  courseKey: string,
  studentId: number,
  nextPreferences: Partial<StudentPreferences>,
): StudentPreferences {
  const allPreferences = safeRead<PreferencesMap<StudentPreferences>>(STUDENT_PREFS_KEY, {});
  const storageKey = `${courseKey}:${studentId}`;
  const merged = {
    ...(allPreferences[storageKey] ?? {}),
    ...nextPreferences,
  };
  allPreferences[storageKey] = merged;
  safeWrite(STUDENT_PREFS_KEY, allPreferences);
  return merged;
}

export function loadRuntimeLogs(): RuntimeLogEntry[] {
  return safeRead<RuntimeLogEntry[]>(RUNTIME_LOGS_KEY, [])
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 20);
}

export function logRuntimeIssue(entry: Omit<RuntimeLogEntry, "id" | "at">): RuntimeLogEntry[] {
  const logs = loadRuntimeLogs();
  const nextEntry: RuntimeLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const nextLogs = [nextEntry, ...logs].slice(0, 20);
  safeWrite(RUNTIME_LOGS_KEY, nextLogs);
  return nextLogs;
}
