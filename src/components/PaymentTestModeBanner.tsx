const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full border-b-2 border-primary bg-highlight px-4 py-2 text-center text-xs font-display uppercase tracking-wide text-highlight-foreground">
      Test mode — payments here aren't real.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Learn more
      </a>
    </div>
  );
}
