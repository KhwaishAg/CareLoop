import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface MedicineCatalogEntry {
  id: string;
  name: string;
  category: string | null;
  commonDosages: string[];
  defaultFrequency: string | null;
}

/** Fetched once and filtered client-side as the doctor types — a few
 *  hundred rows at most, so there's no need to hit the network per
 *  keystroke while completing a visit. */
export function useMedicineCatalog() {
  return useQuery({
    queryKey: ["medicines", "catalog"],
    queryFn: async () => (await api.get<{ medicines: MedicineCatalogEntry[] }>("/api/medicines")).data.medicines,
    staleTime: 10 * 60 * 1000,
  });
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequencyType: string;
  startDate: string;
  endDate: string;
  instructions: string | null;
}

export interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: "HELD" | "BOOKED" | "COMPLETED" | "CANCELLED";
  cancelReason: string | null;
  holdExpiresAt: string | null;
  recommendedFollowUpDate: string | null;
  patient: { id: string; name: string };
  doctor: { id: string; name: string };
  symptomForm: {
    status: "PENDING" | "READY" | "FAILED";
    rawSymptoms?: string;
    urgency: "LOW" | "MEDIUM" | "HIGH" | null;
    urgencyFactors: string[] | null;
    chiefComplaint: string | null;
    suggestedQuestions: string[] | null;
    safetySignalFlagged: boolean;
    safetySignalReason: string | null;
    changeFromLastVisit: {
      newSymptoms: string[];
      resolvedSymptoms: string[];
      ongoingSymptoms: string[];
      summary: string;
    } | null;
  } | null;
  visitNote: {
    status: "PENDING" | "READY" | "FAILED";
    clinicalNotes: string;
    patientSummary: string | null;
    medicationSchedule: string | null;
    followUpSteps: string | null;
  } | null;
  medications: Medication[];
}

export function useMyAppointments() {
  return useQuery({
    queryKey: ["appointments", "mine"],
    queryFn: async () => (await api.get<{ appointments: Appointment[] }>("/api/appointments/mine")).data
      .appointments,
  });
}

export type WorkingHours = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string[]>;

export interface DoctorProfile {
  id: string;
  specialisation: string;
  slotDurationMin: number;
  workingHours?: WorkingHours;
  user: { id: string; name: string; email: string; phone: string | null };
  leaveDays?: { id: string; date: string; reason: string | null }[];
}

export function useDoctors(specialisation?: string) {
  return useQuery({
    queryKey: ["doctors", specialisation],
    queryFn: async () =>
      (await api.get<{ doctors: DoctorProfile[] }>("/api/doctors", { params: { specialisation } })).data
        .doctors,
  });
}

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: ["doctors", "one", id],
    queryFn: async () => (await api.get<{ doctor: DoctorProfile }>(`/api/doctors/${id}`)).data.doctor,
    enabled: !!id,
  });
}

export function useMyDoctorProfile() {
  return useQuery({
    queryKey: ["doctors", "me"],
    queryFn: async () => (await api.get<{ doctor: DoctorProfile }>("/api/doctors/me")).data.doctor,
  });
}

export function useCalendarStatus() {
  return useQuery({
    queryKey: ["calendar", "status"],
    queryFn: async () => (await api.get<{ connected: boolean }>("/api/calendar/status")).data.connected,
  });
}

export type FollowUpStatus = "NONE" | "SCHEDULED" | "ON_TRACK" | "DUE_SOON" | "OVERDUE";

export interface FollowUpRollupEntry {
  status: FollowUpStatus;
  recommendedFollowUpDate: string | null;
  nextAppointmentId: string | null;
  appointment: {
    id: string;
    startTime: string;
    patient: { id: string; name: string };
    doctor: { id: string; name: string };
  };
}

export function useFollowUpRollup() {
  return useQuery({
    queryKey: ["appointments", "follow-ups"],
    queryFn: async () =>
      (await api.get<{ rollup: FollowUpRollupEntry[] }>("/api/appointments/follow-ups")).data.rollup,
  });
}

export interface WaitlistEntry {
  id: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  status: "WAITING" | "OFFERED" | "CLAIMED" | "EXPIRED";
  createdAt: string;
}

export function useMyWaitlist() {
  return useQuery({
    queryKey: ["waitlist", "mine"],
    queryFn: async () => (await api.get<{ entries: WaitlistEntry[] }>("/api/waitlist/mine")).data.entries,
  });
}

export interface AdminWaitlistEntry extends WaitlistEntry {
  patient: { id: string; name: string };
  doctor: { id: string; name: string };
}

export function useAdminWaitlist() {
  return useQuery({
    queryKey: ["admin", "waitlist"],
    queryFn: async () => (await api.get<{ entries: AdminWaitlistEntry[] }>("/api/admin/waitlist")).data.entries,
  });
}

export interface NotificationRow {
  id: string;
  type: string;
  channel: "EMAIL" | "CALENDAR";
  status: "PENDING" | "SENT" | "FAILED";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  appointment: { id: string; startTime: string } | null;
}

export function useAdminNotifications(status?: string) {
  return useQuery({
    queryKey: ["admin", "notifications", status],
    queryFn: async () =>
      (await api.get<{ notifications: NotificationRow[] }>("/api/admin/notifications", { params: { status } }))
        .data.notifications,
  });
}
