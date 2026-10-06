import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SignInHero } from "./SignInHero";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in — Sarah's Foundation",
  description:
    "Sign in to your supporter account to follow projects and track donations, or reach the staff workspace.",
};

export default function SignInPage() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: "72px" }}>
        <SignInHero>
          <Suspense fallback={null}>
            <SignInForm />
          </Suspense>
        </SignInHero>
      </main>
      <Footer />
    </>
  );
}
