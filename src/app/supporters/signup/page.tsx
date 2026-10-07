import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SignupHero } from "./SignupHero";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Join as a supporter — Sarah's Foundation",
  description:
    "Create a free account to follow projects, receive updates, and keep a record of your donations.",
};

export default function SupporterSignupPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "72px" }}>
        <SignupHero>
          <SignupForm />
        </SignupHero>
      </main>
      <Footer />
    </>
  );
}
