import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToHash from "@/components/ScrollToHash";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Account from "./pages/Account.tsx";
import AccountCalendar from "./pages/AccountCalendar.tsx";
import Pets from "./pages/Pets.tsx";
import Profile from "./pages/Profile.tsx";
import Book from "./pages/Book.tsx";
import Checkout from "./pages/Checkout.tsx";
import BookingSuccess from "./pages/BookingSuccess.tsx";
import SitterDashboard from "./pages/SitterDashboard.tsx";
import SitterToday from "./pages/sitter/Today.tsx";
import SitterInbox from "./pages/sitter/Inbox.tsx";
import SitterInvoices from "./pages/sitter/Invoices.tsx";
import SitterCalendar from "./pages/sitter/Calendar.tsx";
import SitterClients from "./pages/sitter/Clients.tsx";
import SitterClientProfile from "./pages/sitter/ClientProfile.tsx";
import SitterPets from "./pages/sitter/Pets.tsx";
import SitterPetProfile from "./pages/sitter/PetProfile.tsx";
import SitterRequestDetail from "./pages/sitter/RequestDetail.tsx";
import SitterBookingDetail from "./pages/sitter/BookingDetail.tsx";
import SitterScheduleAssistant from "./pages/sitter/ScheduleAssistant.tsx";
import SitterMessages from "./pages/sitter/Messages.tsx";
import SitterReports from "./pages/sitter/Reports.tsx";
import SitterReviews from "./pages/sitter/Reviews.tsx";
import SettingsHome from "./pages/sitter/settings/SettingsHome.tsx";
import SettingsRedirect from "./pages/sitter/settings/SettingsRedirect.tsx";
import SettingsAvailability from "./pages/sitter/settings/Availability.tsx";
import SettingsServices from "./pages/sitter/settings/Services.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import FAQ from "./pages/FAQ.tsx";
import Terms from "./pages/Terms.tsx";
import PublicInvoice from "./pages/PublicInvoice.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToHash />
          <PaymentTestModeBanner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/book" element={<Book />} />
            <Route path="/booking/:id/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/booking/:id/success" element={<ProtectedRoute><BookingSuccess /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="/account/calendar" element={<ProtectedRoute><AccountCalendar /></ProtectedRoute>} />
            <Route path="/account/pets" element={<ProtectedRoute><Pets /></ProtectedRoute>} />
            <Route path="/account/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/sitter" element={<ProtectedRoute requireSitter><SitterToday /></ProtectedRoute>} />
            <Route path="/sitter/inbox" element={<ProtectedRoute requireSitter><SitterInbox /></ProtectedRoute>} />
            <Route path="/sitter/requests/:id" element={<ProtectedRoute requireSitter><SitterRequestDetail /></ProtectedRoute>} />
            <Route path="/sitter/bookings/:id" element={<ProtectedRoute requireSitter><SitterBookingDetail /></ProtectedRoute>} />
            <Route path="/sitter/assistant" element={<ProtectedRoute requireSitter><SitterScheduleAssistant /></ProtectedRoute>} />
            <Route path="/sitter/invoices" element={<ProtectedRoute requireSitter><SitterInvoices /></ProtectedRoute>} />
            <Route path="/sitter/calendar" element={<ProtectedRoute requireSitter><SitterCalendar /></ProtectedRoute>} />
            <Route path="/sitter/clients" element={<ProtectedRoute requireSitter><SitterClients /></ProtectedRoute>} />
            <Route path="/sitter/clients/:id" element={<ProtectedRoute requireSitter><SitterClientProfile /></ProtectedRoute>} />
            <Route path="/sitter/pets" element={<ProtectedRoute requireSitter><SitterPets /></ProtectedRoute>} />
            <Route path="/sitter/pets/:id" element={<ProtectedRoute requireSitter><SitterPetProfile /></ProtectedRoute>} />
            <Route path="/sitter/messages" element={<ProtectedRoute requireSitter><SitterMessages /></ProtectedRoute>} />
            <Route path="/sitter/reports" element={<ProtectedRoute requireSitter><SitterReports /></ProtectedRoute>} />
            <Route path="/sitter/reviews" element={<ProtectedRoute requireSitter><SitterReviews /></ProtectedRoute>} />
            <Route path="/sitter/settings" element={<ProtectedRoute requireSitter><SettingsHome /></ProtectedRoute>} />
            <Route path="/sitter/settings/services" element={<ProtectedRoute requireSitter><SettingsServices /></ProtectedRoute>} />
            <Route path="/sitter/settings/availability" element={<ProtectedRoute requireSitter><SettingsAvailability /></ProtectedRoute>} />
            <Route path="/sitter/settings/reminders" element={<ProtectedRoute requireSitter><SettingsRedirect title="Reminders" description="Auto-send invoice reminders on a cadence." hash="#payments" /></ProtectedRoute>} />
            <Route path="/sitter/settings/templates" element={<ProtectedRoute requireSitter><SettingsRedirect title="Templates" description="Email and SMS message templates." hash="#playbook" /></ProtectedRoute>} />
            <Route path="/sitter/settings/branding" element={<ProtectedRoute requireSitter><SettingsRedirect title="Branding" description="Logo and colours on invoices and emails." hash="#playbook" /></ProtectedRoute>} />
            <Route path="/sitter-classic" element={<ProtectedRoute requireSitter><SitterDashboard /></ProtectedRoute>} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/pay/:token" element={<PublicInvoice />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
