import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import "./index.css";
import "./styles/interior.css";

import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { BookingProvider } from "./hooks/useBooking.jsx";
import { PricingProvider } from "./context/PricingContext.jsx";
import { ClubSettingsProvider } from "./context/ClubSettingsContext.jsx";
import { ScheduleProvider } from "./hooks/useSchedule.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";
import { TournamentsProvider } from "./hooks/useTournaments.jsx";
import { TeachersProvider } from "./hooks/useTeachers.jsx";
import { CourtConfigProvider } from "./context/CourtConfigContext.jsx";
import { OrganizationsProvider } from "./hooks/useOrganizations.jsx";

function ProductProviders() {
  const { operatingMode } = useAuth();
  if (operatingMode === "multiclub") return <OrganizationsProvider><ToastProvider><App /></ToastProvider></OrganizationsProvider>;
  return <OrganizationsProvider>
        <BookingProvider>
          <PricingProvider>
            <ClubSettingsProvider>
              <CourtConfigProvider>
              <TournamentsProvider>
              <TeachersProvider>
              <ScheduleProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </ScheduleProvider>
              </TeachersProvider>
              </TournamentsProvider>
              </CourtConfigProvider>
            </ClubSettingsProvider>
          </PricingProvider>
        </BookingProvider>
        </OrganizationsProvider>;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProductProviders />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

const loader = document.getElementById("app-loader");
if (loader) {
  window.requestAnimationFrame(() => {
    loader.classList.add("app-loader--hidden");
    window.setTimeout(() => loader.remove(), 320);
  });
}
