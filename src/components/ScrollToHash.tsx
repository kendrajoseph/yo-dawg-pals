import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element matching the URL hash on every route/hash change.
 * Without this, React Router doesn't auto-scroll to in-page anchors like /#services.
 */
const ScrollToHash = () => {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    const id = hash.slice(1);
    // Defer to next tick so the target section is mounted.
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => clearTimeout(t);
  }, [hash, pathname]);

  return null;
};

export default ScrollToHash;
