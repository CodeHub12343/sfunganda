export const dynamic = "force-dynamic";

export default function AdminHome() {
  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-playfair)", color: "#103D7A", fontSize: "1.6rem", marginBottom: "1rem" }}>
        Overview
      </h2>
      <p style={{ color: "#4b5563", maxWidth: "60ch" }}>
        Welcome to the Sarah&apos;s Foundation admin shell. Choose a section from the sidebar to manage users, review the
        audit log, and more.
      </p>
    </div>
  );
}
