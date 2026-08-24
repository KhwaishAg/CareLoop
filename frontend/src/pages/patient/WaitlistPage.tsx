import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useDoctors, useMyWaitlist } from "../../lib/hooks";
import { StatusPill } from "../../components/StatusPill";
import { doctorLabel } from "../../lib/format";

const STATUS_TONE = { WAITING: "neutral", OFFERED: "positive", CLAIMED: "positive", EXPIRED: "neutral" } as const;
const STATUS_COPY: Record<string, string> = {
  WAITING: "Waiting for a match",
  OFFERED: "A slot was offered — check your appointments",
  CLAIMED: "Booked from this request",
  EXPIRED: "Offer expired unclaimed",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function WaitlistPage() {
  const queryClient = useQueryClient();
  const { data: doctors } = useDoctors();
  const { data: entries, isLoading } = useMyWaitlist();

  const [doctorProfileId, setDoctorProfileId] = useState("");
  const [preferredDate, setPreferredDate] = useState(todayKey());
  const [preferredStartTime, setPreferredStartTime] = useState("09:00");
  const [preferredEndTime, setPreferredEndTime] = useState("17:00");
  const [error, setError] = useState<string | null>(null);

  const joinMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/waitlist", {
          doctorProfileId,
          preferredDate,
          preferredStartTime,
          preferredEndTime,
        })
      ).data,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["waitlist", "mine"] });
    },
    onError: (err: any) => setError(err.response?.data?.error ?? "Couldn't join the waitlist — try again."),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Waitlist</p>
      <h1 className="mb-3 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Get notified the moment a slot opens.
      </h1>
      <p className="mb-12 max-w-2xl text-ink-soft">
        Join a doctor's waitlist for a time window — you'll be offered the first matching slot that frees up,
        earliest requests first.
      </p>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[22rem_1fr]">
        {/* Form — sticky on wide screens so it stays in view while you scan requests */}
        <div className="h-fit rounded-lg border border-line bg-bg-raised p-6 lg:sticky lg:top-8">
          <p className="mb-5 font-mono text-xs uppercase tracking-wide text-ink-soft">New request</p>

          <div className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Doctor</span>
            <select
              value={doctorProfileId}
              onChange={(e) => setDoctorProfileId(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
            >
              <option value="">Select a doctor…</option>
              {doctors?.map((d) => (
                <option key={d.id} value={d.id}>
                  {doctorLabel(d.user.name)} — {d.specialisation}
                </option>
              ))}
            </select>
          </div>

          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Preferred date</span>
            <input
              type="date"
              min={todayKey()}
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
            />
          </label>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">From</span>
              <input
                type="time"
                value={preferredStartTime}
                onChange={(e) => setPreferredStartTime(e.target.value)}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">Until</span>
              <input
                type="time"
                value={preferredEndTime}
                onChange={(e) => setPreferredEndTime(e.target.value)}
                className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
              />
            </label>
          </div>

          {error && <p className="mb-3 text-sm text-critical">{error}</p>}

          <button
            onClick={() => joinMutation.mutate()}
            disabled={!doctorProfileId || joinMutation.isPending}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {joinMutation.isPending ? "Joining…" : "Join waitlist"}
          </button>
        </div>

        {/* Requests list */}
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">Your requests</p>
          {isLoading && <p className="text-ink-soft">Loading…</p>}
          {entries?.length === 0 && (
            <div className="rounded-lg border border-dashed border-line px-6 py-16 text-center text-ink-soft">
              No waitlist requests yet — fill in the form to join one.
            </div>
          )}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entries?.map((e) => (
              <li key={e.id} className="rounded-lg border border-line bg-bg-raised p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-semibold text-ink">
                    {new Date(e.preferredDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </p>
                  <StatusPill label={e.status} tone={STATUS_TONE[e.status]} />
                </div>
                <p className="mb-1 text-sm text-ink-soft">
                  {e.preferredStartTime}–{e.preferredEndTime}
                </p>
                <p className="text-xs text-ink-soft">{STATUS_COPY[e.status]}</p>
                <p className="mt-3 text-xs text-ink-soft">
                  Joined {new Date(e.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
