import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Join as a supporter — Sarah's Foundation",
  description:
    "Create a free account to follow projects, receive updates, and keep a record of your donations.",
};

export default function SupporterSignupPage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Join as a supporter</h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
        Follow projects, receive updates, and keep a copy of your donation receipts.
      </p>
      <SignupForm />
    </main>
  );
}
