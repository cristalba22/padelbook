import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import Footer from "./components/Footer.jsx";

import Home from "./pages/Home.jsx";
import Booking from "./pages/Booking.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Tournaments from "./pages/Tournaments.jsx";
import Comunidad from "./pages/Comunidad.jsx";

import PlayerDashboard from "./pages/PlayerDashboard.jsx";
import Account from "./pages/Account.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";

import Admin from "./pages/Admin.jsx";
import AdminCalendar from "./pages/AdminCalendar.jsx";
import AdminTeachers from "./pages/AdminTeachers.jsx";
import AdminBookings from "./pages/AdminBookings.jsx";
import AdminFinance from "./pages/AdminFinance.jsx";
import AdminTournaments from "./pages/AdminTournaments.jsx";
import AdminConfig from "./pages/AdminConfig.jsx";
import AdminStaff from "./pages/AdminStaff.jsx";
import NotFound from "./pages/NotFound.jsx";
import { Organizations, OrganizationDashboard, VenueOverview } from "./pages/Organizations.jsx";
import VenueBooking from "./pages/VenueBooking.jsx";
import VenueMyBookings from "./pages/VenueMyBookings.jsx";
import VenueAdminBookings from "./pages/VenueAdminBookings.jsx";
const VenueAdminConfig = lazy(() => import("./pages/VenueAdminConfig.jsx"));
const OrganizationStaff = lazy(() => import("./pages/OrganizationStaff.jsx"));
const VenueFinance = lazy(() => import("./pages/VenueFinance.jsx"));
const MulticlubAccount = lazy(() => import("./pages/MulticlubAccount.jsx"));

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
    location.pathname !== ROUTES.ACCOUNT && location.pathname !== ROUTES.RESET_PASSWORD) {
    return <Navigate to={ROUTES.CLUBS} replace />;
  }
  return (
    <div className={`app-shell ${location.pathname === ROUTES.HOME ? "home-experience" : ""}`}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path={ROUTES.BOOKING} element={<Booking />} />
          <Route path={ROUTES.BOOKING_LEGACY} element={<Navigate to={ROUTES.BOOKING} replace />} />
          <Route path={ROUTES.MY_BOOKINGS} element={<MyBookings />} />
          <Route path={ROUTES.TOURNAMENTS} element={<Tournaments />} />
          <Route path={ROUTES.COMMUNITY} element={<Comunidad />} />
          <Route path={ROUTES.ACCOUNT} element={operatingMode === "multiclub" ? <Suspense fallback={<div className="org-state" role="status">Cargando cuenta…</div>}><MulticlubAccount /></Suspense> : <Account />} />
          <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
          <Route path={ROUTES.CLUBS} element={<Organizations />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug`} element={<OrganizationDashboard />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/equipo`} element={<Suspense fallback={<div className="org-state" role="status">Cargando equipo…</div>}><OrganizationStaff /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug`} element={<VenueOverview />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/reservar`} element={<VenueBooking />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/mis-turnos`} element={<VenueMyBookings />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/recepcion/reservas`} element={<VenueAdminBookings />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/recepcion/nueva-reserva`} element={<VenueBooking receptionMode />} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/configuracion`} element={<Suspense fallback={<div className="org-state" role="status">Cargando configuración…</div>}><VenueAdminConfig /></Suspense>} />
          <Route path={`${ROUTES.CLUBS}/:organizationSlug/:venueSlug/caja`} element={<Suspense fallback={<div className="org-state" role="status">Cargando caja…</div>}><VenueFinance /></Suspense>} />

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
        </Routes>
      </Layout>

      {operatingMode !== "multiclub" && !location.pathname.startsWith("/admin") && !location.pathname.startsWith(ROUTES.CLUBS) && <Footer />}
    </div>
  );
}
