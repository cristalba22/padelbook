// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import Footer from "./components/Footer.jsx";

// Páginas públicas / jugador
import Home from "./pages/Home.jsx";
import Booking from "./pages/Booking.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Tournaments from "./pages/Tournaments.jsx";
import Comunidad from "./pages/Comunidad.jsx";

// Dashboards
import PlayerDashboard from "./pages/PlayerDashboard.jsx";
import Account from "./pages/Account.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";

// Panel Admin
import Admin from "./pages/Admin.jsx";
import AdminCalendar from "./pages/AdminCalendar.jsx";
import AdminTeachers from "./pages/AdminTeachers.jsx";
import AdminBookings from "./pages/AdminBookings.jsx";
import AdminFinance from "./pages/AdminFinance.jsx";
import AdminTournaments from "./pages/AdminTournaments.jsx";
import AdminConfig from "./pages/AdminConfig.jsx";
import NotFound from "./pages/NotFound.jsx";

import { useAuth } from "./hooks/useAuth.jsx";
import { ROUTES } from "./constants/routes.js";

/* ================================
   PROTECCIÓN DE RUTAS
================================ */
function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to={ROUTES.HOME} replace />;
  if (user.role !== "admin") return <Navigate to={ROUTES.HOME} replace />;
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

/* ================================
            APP
================================ */
export default function App() {
  return (
    <div className="app-shell">
      {/* HEADER + MODAL LOGIN */}
      <Layout>
        <Routes>
          {/* PÚBLICO / JUGADOR */}
          <Route path="/" element={<Home />} />
          <Route path={ROUTES.BOOKING} element={<Booking />} />
          <Route path={ROUTES.BOOKING_LEGACY} element={<Navigate to={ROUTES.BOOKING} replace />} />
          <Route path={ROUTES.MY_BOOKINGS} element={<MyBookings />} />
          <Route path={ROUTES.TOURNAMENTS} element={<Tournaments />} />
          <Route path={ROUTES.COMMUNITY} element={<Comunidad />} />
          <Route path={ROUTES.ACCOUNT} element={<Account />} />

          {/* Dashboard jugador */}
          <Route
            path={ROUTES.PLAYER}
            element={
              <PlayerRoute>
                <PlayerDashboard />
              </PlayerRoute>
            }
          />

          {/* PANEL PROFESOR */}
          <Route
            path={ROUTES.TEACHER}
            element={
              <TeacherRoute>
                <TeacherDashboard />
              </TeacherRoute>
            }
          />

          <Route path={ROUTES.TEACHER_LEGACY} element={<Navigate to={ROUTES.TEACHER} replace />} />

          {/* PANEL ADMIN */}
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
              <AdminRoute>
                <AdminCalendar />
              </AdminRoute>
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
              <AdminRoute>
                <AdminBookings />
              </AdminRoute>
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

          {/* CUALQUIER OTRA RUTA */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>

      {/* FOOTER GLOBAL */}
      <Footer />
    </div>
  );
}
