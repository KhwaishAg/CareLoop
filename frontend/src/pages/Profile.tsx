import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useMyDoctorProfile } from "../lib/hooks";

const ROLE_LABEL = { PATIENT: "Patient", DOCTOR: "Doctor", ADMIN: "Clinic admin" } as const;
const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "HI", label: "हिन्दी" },
  { code: "TA", label: "தமிழ்" },
  { code: "TE", label: "తెలుగు" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const isDoctor = user?.role === "DOCTOR";
  const { data: doctorProfile } = useMyDoctorProfile();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage ?? "EN");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const profileMutation = useMutation({
    mutationFn: async () =>
      (await api.put("/api/auth/me", { name, phone: phone || undefined, preferredLanguage })).data.user,
    onSuccess: (updated) => {
      updateUser({ name: updated.name, phone: updated.phone, preferredLanguage: updated.preferredLanguage });
      setProfileError(null);
      setEditing(false);
    },
    onError: (err: any) => setProfileError(err.response?.data?.error ?? "Couldn't save — try again."),
  });

  const passwordMutation = useMutation({
    mutationFn: async () => (await api.post("/api/auth/change-password", { currentPassword, newPassword })).data,
    onSuccess: () => {
      setPasswordError(null);
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setChangingPassword(false);
    },
    onError: (err: any) => setPasswordError(err.response?.data?.error ?? "Couldn't change password — try again."),
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent">Account</p>
      <h1 className="mb-10 text-balance font-display text-4xl font-semibold leading-tight text-ink">
        Your profile.
      </h1>

      <div className="mb-8 rounded-xl border border-line bg-bg-raised p-6">
        {!editing ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-accent-soft font-display text-2xl font-semibold text-accent">
                {initials(user.name)}
              </span>
              <div>
                <p className="font-display text-xl font-semibold text-ink">{user.name}</p>
                <p className="text-sm text-ink-soft">{user.email}</p>
                {user.phone && <p className="text-sm text-ink-soft">{user.phone}</p>}
                <p className="mt-1 text-xs uppercase tracking-wide text-ink-soft">{ROLE_LABEL[user.role]}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setName(user.name);
                setPhone(user.phone ?? "");
                setPreferredLanguage(user.preferredLanguage ?? "EN");
                setEditing(true);
              }}
              className="flex-none rounded-lg border border-line px-3.5 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
            >
              Edit
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-soft">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-soft">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
                />
              </label>
            </div>

            <div className="mb-2 text-sm text-ink-soft">Email</div>
            <p className="mb-4 text-ink-soft">
              {user.email} <span className="text-xs">— contact your clinic admin to change this</span>
            </p>

            {user.role === "PATIENT" && (
              <div className="mb-5 flex flex-col gap-1.5">
                <span className="text-sm text-ink-soft">Preferred language</span>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      type="button"
                      key={lang.code}
                      onClick={() => setPreferredLanguage(lang.code)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        preferredLanguage === lang.code
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line text-ink-soft hover:border-ink-soft"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {profileError && <p className="mb-4 text-sm text-critical">{profileError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={() => profileMutation.mutate()}
                disabled={!name.trim() || profileMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {profileMutation.isPending ? "Saving…" : "Save changes"}
              </button>
              <button onClick={() => setEditing(false)} className="text-sm text-ink-soft hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {isDoctor && doctorProfile && (
        <div className="mb-8 rounded-xl border border-line bg-bg-raised p-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Practice</p>
          <p className="text-ink">{doctorProfile.specialisation}</p>
          <p className="mb-4 text-sm text-ink-soft">{doctorProfile.slotDurationMin}-minute consultations</p>
          <Link to="/doctor/settings" className="text-sm text-accent hover:underline">
            Manage practice settings →
          </Link>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-line bg-bg-raised p-6">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-ink-soft">Password</p>

        {!changingPassword ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              {passwordSaved ? "Password updated." : "Change your account password."}
            </p>
            <button
              onClick={() => {
                setPasswordSaved(false);
                setChangingPassword(true);
              }}
              className="rounded-lg border border-line px-3.5 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
            >
              Change password
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-soft">Current password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-ink-soft">New password</span>
                <input
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-lg border border-line bg-bg px-3.5 py-2.5 outline-none focus:border-accent"
                />
              </label>
            </div>

            {passwordError && <p className="mb-4 text-sm text-critical">{passwordError}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={() => passwordMutation.mutate()}
                disabled={!currentPassword || newPassword.length < 8 || passwordMutation.isPending}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {passwordMutation.isPending ? "Updating…" : "Update password"}
              </button>
              <button
                onClick={() => {
                  setChangingPassword(false);
                  setPasswordError(null);
                }}
                className="text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-bg-raised p-6">
        <p className="mb-1 text-ink">Signed in as {user.email}</p>
        <p className="mb-4 text-sm text-ink-soft">
          Need your email changed, or an account removed? Ask your clinic admin.
        </p>
        <button
          onClick={logout}
          className="rounded-lg border border-critical px-4 py-2 text-sm text-critical transition hover:bg-critical-soft"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
