import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Spinner } from "@/components/ui";
import { useI18n } from "@/contexts/I18nContext";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import ServiceDetails from "@/pages/ServiceDetails";
import Enhancements from "@/pages/Enhancements";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Legal from "@/pages/Legal";
import NotFound from "@/pages/NotFound";

// Larger, signed-in areas load on demand.
const Booking = lazy(() => import("@/pages/Booking"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const TherapistDashboard = lazy(() => import("@/pages/TherapistDashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-deep focus:px-5 focus:py-3 focus:text-white">{t("nav.skip")}</a>
      <ScrollToTop />
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<Spinner label={t("common.loading")} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:slug" element={<ServiceDetails />} />
            <Route path="/enhancements" element={<Enhancements />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/book" element={<Booking />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/privacy" element={<Legal kind="privacy" />} />
            <Route path="/terms" element={<Legal kind="terms" />} />
            <Route path="/account" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="/therapist" element={<ProtectedRoute roles={["therapist"]}><TherapistDashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={["office_manager"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
