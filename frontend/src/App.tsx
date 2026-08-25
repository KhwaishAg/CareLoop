import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PortalLayout } from "./components/PortalLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PatientHome } from "./pages/patient/PatientHome";
import { BookingPage } from "./pages/patient/BookingPage";
import { PatientAppointmentDetail } from "./pages/patient/AppointmentDetail";
import { WaitlistPage } from "./pages/patient/WaitlistPage";
import { MedicationsPage } from "./pages/patient/Medications";
import { TimelinePage } from "./pages/patient/Timeline";
import { PatientAppointmentsList } from "./pages/patient/Appointments";
import { DoctorProfilePage } from "./pages/patient/DoctorProfile";
import { ProfilePage } from "./pages/Profile";
import { DoctorHome } from "./pages/doctor/DoctorHome";
import { DoctorAppointmentDetail } from "./pages/doctor/DoctorAppointmentDetail";
import { DoctorPatients } from "./pages/doctor/Patients";
import { DoctorFollowUps } from "./pages/doctor/DoctorFollowUps";
import { DoctorSettings } from "./pages/doctor/DoctorSettings";
import { PatientTimeline } from "./pages/doctor/PatientTimeline";
import { DoctorCalendar } from "./pages/doctor/Calendar";
import { DoctorPrescriptions } from "./pages/doctor/Prescriptions";
import { AdminHome } from "./pages/admin/AdminHome";
import { AdminDoctors } from "./pages/admin/Doctors";
import { AdminDoctorLeave } from "./pages/admin/DoctorLeave";
import { AdminNotifications } from "./pages/admin/Notifications";
import { AdminWaitlist } from "./pages/admin/Waitlist";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute roles={["PATIENT"]}>
            <PortalLayout homePath="/dashboard" />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<PatientHome />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/doctors/:id" element={<DoctorProfilePage />} />
        <Route path="/appointments" element={<PatientAppointmentsList />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/medications" element={<MedicationsPage />} />
        <Route path="/appointments/:id" element={<PatientAppointmentDetail />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute roles={["DOCTOR"]}>
            <PortalLayout homePath="/doctor" />
          </ProtectedRoute>
        }
      >
        <Route path="/doctor" element={<DoctorHome />} />
        <Route path="/doctor/appointments/:id" element={<DoctorAppointmentDetail />} />
        <Route path="/doctor/patients" element={<DoctorPatients />} />
        <Route path="/doctor/patients/:patientId" element={<PatientTimeline />} />
        <Route path="/doctor/follow-ups" element={<DoctorFollowUps />} />
        <Route path="/doctor/calendar" element={<DoctorCalendar />} />
        <Route path="/doctor/prescriptions" element={<DoctorPrescriptions />} />
        <Route path="/doctor/settings" element={<DoctorSettings />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <PortalLayout homePath="/admin" />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/doctors" element={<AdminDoctors />} />
        <Route path="/admin/doctors/:id/leave" element={<AdminDoctorLeave />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/waitlist" element={<AdminWaitlist />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
