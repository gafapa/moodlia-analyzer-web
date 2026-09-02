import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Brain, ChevronRight, GraduationCap, KeyRound, LoaderCircle, Trash2 } from "lucide-react";

import { AiSettingsDialog } from "../common/AiSettingsDialog";
import { DEFAULT_FORM } from "../../constants/ui";
import { probeExtensionBridge } from "../../lib/extensionBridge";
import { translate } from "../../lib/i18n";
import type { AiSettings, ConnectFormValues, ConnectionProfile, LanguageCode } from "../../types";

export type ConnectionScreenProps = {
  profiles: ConnectionProfile[];
  language: LanguageCode;
  aiSettings: AiSettings;
  extensionBridgeAvailable: boolean;
  loading: boolean;
  error: string | null;
  onDeleteProfile: (name: string) => void;
  onClearCachedAnalyses: () => Promise<void>;
  onConnect: (values: ConnectFormValues) => Promise<void>;
  onSaveAiSettings: (settings: AiSettings) => void;
};

export function ConnectionScreen(props: ConnectionScreenProps): JSX.Element {
  const [form, setForm] = useState<ConnectFormValues>(DEFAULT_FORM);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(props.language, key);

  useEffect(() => {
    if (!props.extensionBridgeAvailable) {
      probeExtensionBridge();
    }
  }, [props.extensionBridgeAvailable]);

  function fillFromProfile(profile: ConnectionProfile): void {
    setForm({
      profileName: profile.name,
      baseUrl: profile.url,
      token: profile.token,
      username: profile.username ?? "",
      password: "",
      saveProfile: true,
    });
  }

  return (
    <main className="connect-layout">
      <section className="profile-rail surface surface--dark">
        <div>
          <div className="eyebrow">{t("profiles")}</div>
          <h2>{t("reusableEntryPoints")}</h2>
          <p>{t("profilesHelp")}</p>
        </div>
        <div className="profile-list">
          {props.profiles.length === 0 ? <div className="empty-note">{t("noSavedProfilesYet")}</div> : null}
          {props.profiles.map((profile) => (
            <div key={profile.name} className="profile-entry">
              <button type="button" className="profile-chip" onClick={() => fillFromProfile(profile)}>
                <span>
                  <strong>{profile.name}</strong>
                  <small>{profile.url}</small>
                </span>
                <ChevronRight aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                className="profile-delete-button"
                aria-label={`${t("deleteProfile")} ${profile.name}`}
                onClick={() => props.onDeleteProfile(profile.name)}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="privacy-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setCacheStatus(null);
              void props.onClearCachedAnalyses()
                .then(() => setCacheStatus(t("cacheCleared")))
                .catch(() => setCacheStatus(t("cacheClearFailed")));
            }}
          >
            <Trash2 aria-hidden="true" size={16} />
            {t("clearCachedAnalyses")}
          </button>
          {cacheStatus ? <p className="privacy-status" role="status" aria-live="polite">{cacheStatus}</p> : null}
        </div>
      </section>

      <section className="surface connect-form">
        <div className="form-header">
          <div>
            <div className="eyebrow">{t("connection")}</div>
            <h2>{t("directMoodleAccess")}</h2>
            <p>{t("connectionHelpPrimary")}</p>
            <p>{t("connectionHelpSecondary")}</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setShowAiSettings(true)}>
            <Brain aria-hidden="true" size={16} />
            {t("aiSettings")}
          </button>
        </div>

        <div className={`bridge-banner ${props.extensionBridgeAvailable ? "is-available" : "is-missing"}`}>
          <Brain aria-hidden="true" size={16} />
          <span>{props.extensionBridgeAvailable ? t("extensionDetected") : t("extensionMissing")}</span>
        </div>


        <form className="grid-form" onSubmit={(event) => { event.preventDefault(); void props.onConnect(form); }}>
          <label>
            <span>{t("profileName")}</span>
            <input value={form.profileName} onChange={(event) => setForm((current) => ({ ...current, profileName: event.target.value }))} placeholder={t("myMoodle")} />
          </label>
          <label>
            <span>{t("moodleUrl")}</span>
            <input required type="url" inputMode="url" autoComplete="url" value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://moodle.example.com" />
          </label>
          <label>
            <span>{t("token")}</span>
            <input type="password" autoComplete="off" value={form.token} onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))} placeholder={t("pasteExistingToken")} />
          </label>
          <label>
            <span>{t("username")}</span>
            <input autoComplete="username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder={t("optionalWhenTokenPresent")} />
          </label>
          <label>
            <span>{t("password")}</span>
            <input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={t("onlyUsedToRequestToken")} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.saveProfile} onChange={(event) => setForm((current) => ({ ...current, saveProfile: event.target.checked }))} />
            <span>{t("saveProfile")}</span>
          </label>

          <div className="form-note">
            <KeyRound aria-hidden="true" size={16} />
            {t("generateToken")}
          </div>
          {props.error ? <div className="error-banner" role="alert">{props.error}</div> : null}
          <button className="primary-button primary-button--wide" disabled={props.loading} type="submit">
            {props.loading ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <GraduationCap aria-hidden="true" size={16} />}
            {t("connect")}
          </button>
        </form>
      </section>

      {showAiSettings ? (
        <AiSettingsDialog
          initialSettings={props.aiSettings}
          language={props.language}
          onClose={() => setShowAiSettings(false)}
          onSave={(settings) => {
            props.onSaveAiSettings(settings);
            setShowAiSettings(false);
          }}
        />
      ) : null}
    </main>
  );
}
