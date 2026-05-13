import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> into <head> for SEO.
 * Renders nothing in the DOM tree.
 */
export function SeoJsonLd({ id, data }: { id: string; data: Record<string, unknown> }) {
  useEffect(() => {
    const scriptId = `jsonld-${id}`;
    let el = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = scriptId;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      el?.parentNode?.removeChild(el);
    };
  }, [id, data]);

  return null;
}
