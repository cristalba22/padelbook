// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// hooks
import { useAuth } from "./hooks/useAuth.jsx";

// páginas
import Home from "./pages/Home.jsx";
import Booking from "./pages/Booking.jsx";
import Admin from "./pages/Admin.jsx";
import PlayerDashboard from "./pages/PlayerDashboard.jsx"; // Mis turnos
import Account from "./pages/Account.jsx";
import Torneos from "./pages/Torneos.jsx";
import Comunidad from "./pages/Comunidad.jsx";

// componentes
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import SplashScreen from "./components/SplashScreen.jsx";

export default function App() {
  const { user } = useAuth();

  function PrivateRoute({ children, adminOnly = false }) {
    if (!user) return <Navigate to="/account" replace />;
    if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
    return children;
  }

  return (
    <Router>
      <div
        className="flex flex-col min-h-screen transition-colors duration-500"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <SplashScreen />
        <Header />

        <main className="flex-grow">
          <Routes>
            {/* pública */}
            <Route path="/" element={<Home />} />

            {/* reservar: login */}
            <Route
              path="/booking"
              element={
                <PrivateRoute>
                  <Booking />
                </PrivateRoute>
              }
            />

            {/* mis turnos: login */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <PlayerDashboard />
                </PrivateRoute>
              }
            />

            {/* admin: solo admin */}
            <Route
              path="/admin"
              element={
                <PrivateRoute adminOnly>
                  <Admin />
                </PrivateRoute>
              }
            />

            {/* torneos: ahora también login */}
            <Route
              path="/torneos"
              element={
                <PrivateRoute>
                  <Torneos />
                </PrivateRoute>
              }
            />

            {/* comunidad: login */}
            <Route
              path="/comunidad"
              element={
                <PrivateRoute>
                  <Comunidad />
                </PrivateRoute>
              }
            />

            {/* login / registro */}
            <Route path="/account" element={<Account />} />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}
