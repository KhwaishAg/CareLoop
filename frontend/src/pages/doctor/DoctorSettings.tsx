import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useCalendarStatus, useMyDoctorProfile } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const CALENDAR_MESSAGE: Record<string, { text: string; tone: "positive" | "critical" }> = {
  connected: { text: "Google Calendar connected.", tone: "positive" },
  denied: { text: "Calendar connection was cancelled.", tone: "critical" },
  error: { text: "Something went wrong connecting your calendar — try again.", tone: "critical" },
};

export function DoctorSettings() {
  const [params] = useSearchParams();
  const calendarParam = params.get("calendar");
  const { data: connected, isLoading, refetch } = useCalendarStatus();
  const { data: profile, isLoading: profileLoading, isError: profileError } = useMyDoctorProfile();

  const connectMutation = useMutation({
    mutationFn: async () => (await api.get<{ url: string }>("/api/calendar/oauth/connect")).data.url,
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const connectError =
    connectMutation.isError &&
    ((connectMutation.error as any)?.response?.data?.error ??
      "Couldn't start Google Calendar connection — try again.");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Settings</p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Your practice.
      </h1>

      {calendarParam && CALENDAR_MESSAGE[calendarParam] && (
        <div
          className={`mb-8 rounded-lg border px-4 py-3 text-sm ${
            CALENDAR_MESSAGE[calendarParam].tone === "positive"
              ? "border-accent bg-accent-soft text-accent"
              : "border-critical bg-critical-soft text-critical"
          }`}
        >
          {CALENDAR_MESSAGE[calendarParam].text}
        </div>
      )}

      <section className="mb-10 border-b border-line pb-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Google Calendar</p>
        <p className="mb-4 text-ink-soft">
          Booked appointments sync straight to your calendar, with the patient added as an attendee so they get
          Google's own reminders too.
        </p>
        <div className="flex items-center gap-4">
          {isLoading ? (
            <span className="text-sm text-ink-soft">Checking…</span>
          ) : (
            <StatusPill label={connected ? "Connected" : "Not connected"} tone={connected ? "positive" : "neutral"} />
          )}
          {!connected && (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {connectMutation.isPending ? "Redirecting…" : "Connect Google Calendar"}
            </button>
          )}
          {connected && (
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition hover:border-accent hover:text-accent"
            >
              Open Google Calendar ↗
            </a>
          )}
          {connected && (
            <button onClick={() => refetch()} className="text-sm text-ink-soft hover:text-accent">
              Refresh status
            </button>
          )}
        </div>
        {connectError && <p className="mt-3 text-sm text-critical">{connectError}</p>}
      </section>

      <section>
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Profile</p>
        {profileLoading && <p className="text-ink-soft">Loading…</p>}
        {profileError && (
          <p className="text-critical">Couldn't load your profile — try refreshing the page.</p>
        )}
        {profile && (
          <>
            {profile.user && <p className="text-ink">{doctorLabel(profile.user.name)}</p>}
            <p className="text-ink-soft">{profile.specialisation}</p>
            <p className="text-ink-soft">{profile.slotDurationMin}-minute slots</p>
            <p className="mt-2 text-sm text-ink-soft">
              Working hours and leave days are managed by clinic admins from the operations room.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
