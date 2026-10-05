"use client";

import { useEffect } from "react";
import NextLink from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // When error tracking is wired up (Phase 0 infra), the DSN forwards this
    // automatically. For now, surface the error so operators see it in logs.
    console.error("[app] runtime error", { digest: error.digest });
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "4rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 520 }}>
        <h1
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            color: "#103D7A",
            marginBottom: "0.75rem",
          }}
        >
          Something went wrong.
        </h1>
        <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>
          We&apos;ve been notified and will take a look. Meanwhile you can try
          again, or head back home.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.85rem 1.5rem",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg,#F7B733,#F28C28)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <NextLink
            href="/"
            style={{
              padding: "0.85rem 1.5rem",
              borderRadius: 999,
              border: "1.5px solid #103D7A",
              color: "#103D7A",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Go home
          </NextLink>
        </div>
      </div>
    </main>
  );
}
