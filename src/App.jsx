import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import Footer from "./components/Footer.jsx";

import Home from "./pages/Home.jsx";
const Booking = lazy(() => import("./pages/Booking.jsx"));
const MyBookings = lazy(() => import("./pages/MyBookings.jsx"));
const Tournaments = lazy(() => import("./pages/Tournaments.jsx"));
const Comunidad = lazy(() => import("./pages/Comunidad.jsx"));
const PlayerDashboard = lazy(() => import("./pages/PlayerDashboard.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const AdminCalendar = lazy(() => import("./pages/AdminCalendar.jsx"));
const AdminTeachers = lazy(() => import("./pages/AdminTeachers.jsx"));
const AdminBookings = lazy(() => import("./pages/AdminBookings.jsx"));
const AdminFinance = lazy(() => import("./pages/AdminFinance.jsx"));
const AdminTournaments = lazy(() => import("./pages/AdminTournaments.jsx"));
const AdminConfig = lazy(() => import("./pages/AdminConfig.jsx"));
const AdminStaff = lazy(() => import("./pages/AdminStaff.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const OrganizationsPage = lazy(() => import("./pages/Organizations.jsx").then(({ Organizations }) => ({ default: Organizations })));
const OrganizationDashboard = lazy(() => import("./pages/Organizations.jsx").then(({ OrganizationDashboard: page }) => ({ default: page })));
const VenueOverview = lazy(() => import("./pages/Organizations.jsx").then(({ VenueOverview: page }) => ({ default: page })));
const VenueBooking = lazy(() => import("./pages/VenueBooking.jsx"));
const VenueMyBookings = lazy(() => import("./pages/VenueMyBookings.jsx"));
const VenueAdminBookings = lazy(() => import("./pages/VenueAdminBookings.jsx"));
const VenueAdminConfig = lazy(() => import("./pages/VenueAdminConfig.jsx"));
const OrganizationStaff = lazy(() => import("./pages/OrganizationStaff.jsx"));
const VenueFinance = lazy(() => import("./pages/VenueFinance.jsx"));
const MulticlubAccount = lazy(() => import("./pages/MulticlubAccount.jsx"));
const VenueTeachers = lazy(() => import("./pages/VenueTeachers.jsx"));
const VenueTournaments = lazy(() => import("./pages/VenueTournaments.jsx"));
const VenueTeacherSchedule = lazy(() => import("./pages/VenueTeacherSchedule.jsx"));
const Invitation = lazy(() => import("./pages/Invitation.jsx"));

import { useAuth } from "./hooks/useAuth.jsx";
import { ROUTES } from "./constants/routes.js";

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={ROUTES.HOME} replace />;
  if (user.role !== "admin") return <Navigate to={user.role === "receptionist" ? ROUTES.ADMIN_BOOKINGS : ROUTES.HOME} replace />;
  return children;
}

function ClubOperationsRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={ROUTES.HOME} replace />;
  if (!["admin", "receptionist"].includes(user.role)) return <Navigate to={ROUTES.HOME} replace />;
  return children;
}

function TeacherRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={ROUTES.HOME} replace />;
  if (user.role !== "teacher") return <Navigate to={ROUTES.HOME} replace />;
  return children;
}

function PlayerRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={ROUTES.ACCOUNT} replace />;
  if (user.role !== "player") return <Navigate to={ROUTES.HOME} replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const { operatingMode } = useAuth();
  if (operatingMode === "multiclub" && location.pathname !== ROUTES.CLUBS && !location.pathname.startsWith(`${ROUTES.CLUBS}/`) &&
    location.pathname !== ROUTES.ACCOUNT && location.pathname !== ROUTES.RESET_PASSWORD && location.pathname !== ROUTES.INVITATION) {
    return <Navigate to={ROUTES.CLUBS} replace />;
  }
  return (
    <div className={`app-shell ${location.pathname === ROUTES.HOME ? "home-experience" : ""}`}>
      <Layout>
        <Suspense fallback={<main className="org-state" role="status">Cargando página…</main>}><Routes>
          <Route path="/" element={<Home />} />
          <Route path={ROUTES.BOOKING} element={<Booking />} />
          <Route path={ROUTES.BOOKING_LEGACY} element={<Navigate to={ROUTES.BOOKING} replace />} />
          <Route path={ROUTES.MY_BOOKINGS} element={<MyBookings />} />
          <Route path={ROUTES.TOURNAMENTS} element={<Tournaments />} />
          <Route path={ROUTES.COMMUNITY} element={<Comunidad />} />
          <Route path={ROUTES.ACCOUNT} element={operatingMode === "multiclub" ? <Suspense fallback={<div className="org-state" role="status">Cargando cuenta…</div>}><MulticlubAccount /></Suspense> : <Account />} />
          <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
          <Route path={ROUTES.INVITATION} element={<Invitation />} />
          <Route path={ROUTES.CLUBS} element={<OrganizationsPage />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug`} element={<OrganizationDashboard />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/equipo`} element={<Suspense fallback={<div className="org-state" role="status">Cargando equipo…</div>}><OrganizationStaff /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug`} element={<VenueOverview />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/reservar`} element={<VenueBooking />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/mis-turnos`} element={<VenueMyBookings />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/recepcion/reservas`} element={<VenueAdminBookings />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/recepcion/nueva-reserva`} element={<VenueBooking receptionMode />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/configuracion`} element={<Suspense fallback={<div className="org-state" role="status">Cargando configuración…</div>}><VenueAdminConfig /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/caja`} element={<Suspense fallback={<div className="org-state" role="status">Cargando caja…</div>}><VenueFinance /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/profesores`} element={<Suspense fallback={<div className="org-state" role="status">Cargando profesores…</div>}><VenueTeachers /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/mis-clases`} element={<Suspense fallback={<div className="org-state" role="status">Cargando clases…</div>}><VenueTeacherSchedule /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/torneos`} element={<Suspense fallback={<div className="org-state" role="status">Cargando torneos…</div>}><VenueTournaments /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/torneos/gestionar`} element={<Suspense fallback={<div className="org-state" role="status">Cargando torneos…</div>}><VenueTournaments management /></Suspense>} />

          <Route
            path={ROUTES.PLAYER}
            element={
              <PlayerRoute>
                <PlayerDashboard />
              </PlayerRoute>
            }
          />

          <Route
            path={ROUTES.TEACHER}
            element={
              <TeacherRoute>
                <TeacherDashboard />
              </TeacherRoute>
            }
          />

          <Route path={ROUTES.TEACHER_LEGACY} element={<Navigate to={ROUTES.TEACHER} replace />} />

          <Route
            path={ROUTES.ADMIN}
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN_CALENDAR}
            element={
              <ClubOperationsRoute>
                <AdminCalendar />
              </ClubOperationsRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN_TEACHERS}
            element={
              <AdminRoute>
                <AdminTeachers />
              </AdminRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN_BOOKINGS}
            element={
              <ClubOperationsRoute>
                <AdminBookings />
              </ClubOperationsRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN_FINANCE}
            element={
              <AdminRoute>
                <AdminFinance />
              </AdminRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN_TOURNAMENTS}
            element={
              <AdminRoute>
                <AdminTournaments />
              </AdminRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN_CONFIG}
            element={
              <AdminRoute>
                <AdminConfig />
              </AdminRoute>
            }
          />
          <Route path={ROUTES.ADMIN_STAFF} element={<AdminRoute><AdminStaff /></AdminRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes></Suspense>
      </Layout>

      {operatingMode !== "multiclub" && !location.pathname.startsWith("/admin") && !location.pathname.startsWith(ROUTES.CLUBS) && <Footer />}
    </div>
  );
}
