import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The terms that govern your use of the Sarah's Foundation website and donations made through it.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main>
        <LegalPage title="Terms of use" updated="October 2026">
          <p>
            These terms govern your use of the Sarah&apos;s Foundation
            website. By using the site, you agree to them.
          </p>

          <h2>About us</h2>
          <p>
            Sarah&apos;s Foundation Uganda is a children&apos;s care programme
            operating in Uganda in partnership with Honest Need. The
            foundation is pursuing full legal registration; the status of
            that process is shared on our{" "}
            <Link href="/#transparency">Transparency</Link> section.
          </p>

          <h2>Donations</h2>
          <ul>
            <li>
              Donations are processed by Stripe. The charge appears on your
              statement as a payment to Sarah&apos;s Foundation or Honest
              Need.
            </li>
            <li>
              Monthly donations renew automatically each month until you
              cancel. You can cancel at any time by emailing{" "}
              <a href="mailto:hello@honestneed.com">hello@honestneed.com</a>.
            </li>
            <li>
              All donations are considered final and non-refundable except in
              the case of a demonstrable error. Contact us within 30 days of
              the charge for any refund request.
            </li>
            <li>
              Donations are used to fund the programmes described on this
              site. We cannot guarantee tax deductibility in your jurisdiction
              until the foundation&apos;s legal registration is complete.
            </li>
          </ul>

          <h2>Volunteering</h2>
          <p>
            When you sign up to volunteer, you confirm that the information
            you provide is accurate and that you are over 18. You can
            withdraw from volunteering at any time by replying to any of our
            emails or writing to{" "}
            <a href="mailto:hello@honestneed.com">hello@honestneed.com</a>.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Please do not attempt to disrupt the site, submit false
            information, scrape content en masse, or use the site in a way
            that could harm the children in our care, our supporters, or our
            partners.
          </p>

          <h2>No warranties</h2>
          <p>
            The site is provided &quot;as is.&quot; We work hard to keep it
            accurate and up to date, but we do not guarantee it will always
            be available or free of errors.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms as the programme and legal environment
            evolve. The &quot;last updated&quot; date above reflects the most
            recent change.
          </p>
        </LegalPage>
      </main>
      <Footer />
    </>
  );
}
