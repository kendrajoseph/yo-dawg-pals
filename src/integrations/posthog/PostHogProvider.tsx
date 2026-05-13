import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import posthog from "posthog-js";
import { useAuth } from "@/hooks/useAuth";

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ||
  "phc_uew7bjdMcHVcgzV8crJdLN3wsoY2Mgq6GFcxntqiTXZG";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

// Initialize PostHog once at module load.
// Only runs in production to avoid polluting analytics with local dev events.
if (typeof window !== "undefined" && POSTHOG_KEY && import.meta.env.PROD) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Page leave tracking is auto-enabled with capture_pageview: true
    capture_pageview: false, // We'll manually track to handle SPA navigation
    capture_pageleave: true,
    // Respect Do Not Track
    respect_dnt: true,
    // Don't capture sensitive form fields
    mask_all_text: false,
    mask_all_element_attributes: false,
    autocapture: {
      // Don't auto-capture clicks on password fields or anything marked sensitive
      dom_event_allowlist: ["click", "submit"],
      css_selector_allowlist: undefined,
      element_allowlist: undefined,
    },
    // Session replay settings
    session_recording: {
      maskAllInputs: true, // Mask all input fields by default for privacy
      maskTextSelector: "[data-sensitive]", // Anything tagged data-sensitive
    },
    // Reduce data sent for users who opt out of cookies
    persistence: "localStorage+cookie",
  });
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();

  // Track page views on SPA route change
  useEffect(() => {
    if (!POSTHOG_KEY || !import.meta.env.PROD) return;
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [location.pathname]);

  // Identify the user when they sign in, reset on sign out
  useEffect(() => {
    if (!POSTHOG_KEY || !import.meta.env.PROD) return;
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
      });
    } else {
      posthog.reset();
    }
  }, [user]);

  return <>{children}</>;
}

// Helper for tracking events from anywhere in the app
export function track(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY || !import.meta.env.PROD) {
    // Optional: log to console in dev for debugging
    if (import.meta.env.DEV) {
      console.log("[analytics]", event, properties);
    }
    return;
  }
  posthog.capture(event, properties);
}
