import type { Metadata } from "next";
import NextLink from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
        <p
          style={{
            fontSize: "0.78rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#3D8B37",
            marginBottom: "0.75rem",
          }}
        >
          404
        </p>
        <h1
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            color: "#103D7A",
            marginBottom: "0.75rem",
          }}
        >
          We can&apos;t find that page.
        </h1>
        <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>
          The link may be out of date, or the page may have moved.
        </p>
        <NextLink
          href="/"
          style={{
            display: "inline-block",
            padding: "0.85rem 1.5rem",
            borderRadius: 999,
            background: "linear-gradient(135deg,#F7B733,#F28C28)",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to home
        </NextLink>
      </div>
    </main>
  );
}
