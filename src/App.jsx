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
  return (
    <div className={`app-shell ${location.pathname === ROUTES.HOME ? "home-experience" : ""}`}>
      <Layout>
        <Suspense fallback={<main className="connection-page" role="status">Cargando página…</main>}><Routes>
          <Route path="/" element={<Home />} />
          <Route path={ROUTES.BOOKING} element={<Booking />} />
          <Route path={ROUTES.BOOKING_LEGACY} element={<Navigate to={ROUTES.BOOKING} replace />} />
          <Route path={ROUTES.MY_BOOKINGS} element={<MyBookings />} />
          <Route path={ROUTES.TOURNAMENTS} element={<Tournaments />} />
          <Route path={ROUTES.COMMUNITY} element={<Comunidad />} />
          <Route path={ROUTES.ACCOUNT} element={<Account />} />
          <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />

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

      {!location.pathname.startsWith("/admin") && <Footer />}
    </div>
  );
}
