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
import Account from "./pages/Account.tsx";
import Pets from "./pages/Pets.tsx";
import Profile from "./pages/Profile.tsx";
import Book from "./pages/Book.tsx";
import Checkout from "./pages/Checkout.tsx";
import BookingSuccess from "./pages/BookingSuccess.tsx";
import SitterDashboard from "./pages/SitterDashboard.tsx";
import SitterToday from "./pages/sitter/Today.tsx";
import SitterInbox from "./pages/sitter/Inbox.tsx";
import SitterInvoices from "./pages/sitter/Invoices.tsx";
import SitterPagePlaceholder from "./pages/sitter/Placeholder.tsx";
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
            <Route path="/book" element={<Book />} />
            <Route path="/booking/:id/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
            <Route path="/booking/:id/success" element={<ProtectedRoute><BookingSuccess /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="/account/pets" element={<ProtectedRoute><Pets /></ProtectedRoute>} />
            <Route path="/account/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/sitter" element={<ProtectedRoute requireSitter><SitterToday /></ProtectedRoute>} />
            <Route path="/sitter/inbox" element={<ProtectedRoute requireSitter><SitterInbox /></ProtectedRoute>} />
            <Route path="/sitter/invoices" element={<ProtectedRoute requireSitter><SitterInvoices /></ProtectedRoute>} />
            <Route path="/sitter/calendar" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Calendar" description="Day, week, and month view of confirmed bookings." /></ProtectedRoute>} />
            <Route path="/sitter/clients" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Clients" description="Your client directory with star ratings and notes." /></ProtectedRoute>} />
            <Route path="/sitter/pets" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Pets" description="Pet profiles, temperament tags, and approval queue." /></ProtectedRoute>} />
            <Route path="/sitter/messages" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Messages" description="Conversations with clients and broadcast updates." /></ProtectedRoute>} />
            <Route path="/sitter/reports" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Reports" description="Revenue, top services, and accounts-receivable aging." /></ProtectedRoute>} />
            <Route path="/sitter/settings" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Settings" description="Services, availability, reminders, templates, and branding." /></ProtectedRoute>} />
            <Route path="/sitter/settings/availability" element={<ProtectedRoute requireSitter><SitterPagePlaceholder title="Availability" description="Weekly hours, walk windows, and blocked dates." /></ProtectedRoute>} />
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
