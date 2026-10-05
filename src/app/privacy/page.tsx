import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Sarah's Foundation collects, uses, and protects the personal information of donors, volunteers, and visitors.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main>
        <LegalPage title="Privacy policy" updated="October 2026">
          <p>
            Sarah&apos;s Foundation Uganda (&quot;we&quot;, &quot;us&quot;)
            cares about the privacy of the children in our programmes and the
            supporters who make our work possible. This page explains what we
            collect, why we collect it, and how we keep it safe.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Donations</strong> — processed by Stripe. We do not store
              card numbers or bank details on our servers; Stripe handles that
              under PCI DSS. We retain donor name, email, amount, and
              donation date for receipting and legal recordkeeping.
            </li>
            <li>
              <strong>Volunteer signups</strong> — name, email, country, city
              or region, and the tasks you choose. A phone number when you
              volunteer for text outreach, and a mailing address only when you
              volunteer to receive printed materials.
            </li>
            <li>
              <strong>Site analytics</strong> — standard server logs
              (timestamps, IP address, request path) are retained for 30 days
              for security and debugging. We do not use advertising cookies.
            </li>
          </ul>

          <h2>How we use it</h2>
          <p>
            We use donor information to acknowledge gifts, send receipts, and
            keep statutory financial records. We use volunteer information to
            contact you about the task you agreed to and to coordinate your
            help. We never sell or trade your personal information.
          </p>

          <h2>Who sees it</h2>
          <p>
            Only the Sarah&apos;s Foundation operations team and the Honest
            Need partnership have access. We use a small number of trusted
            processors — Stripe for payment processing, Resend for
            transactional email, and a spreadsheet-backed webhook for
            volunteer coordination — each bound by their own privacy terms.
          </p>

          <h2>Retention</h2>
          <p>
            Financial records are retained for the statutory period required
            by applicable law (commonly seven years). Volunteer records are
            retained for twenty-four months of inactivity, then deleted or
            anonymised. Server logs are kept for thirty days with no personal
            data in log lines.
          </p>

          <h2>Your rights</h2>
          <p>
            You may ask us to access, correct, or delete your personal
            information. Email{" "}
            <a href="mailto:hello@honestneed.com">hello@honestneed.com</a>{" "}
            and we will respond within a reasonable time. Financial records
            we are legally required to retain are not deleted; your identity
            is detached from them on request.
          </p>

          <h2>Children</h2>
          <p>
            This site is intended for adults. We do not knowingly collect
            personal information from children. The children in our care are
            never named, photographed, or quoted on the public site without
            verified consent and a safeguarding review.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy? Email{" "}
            <a href="mailto:hello@honestneed.com">hello@honestneed.com</a>.
          </p>
        </LegalPage>
      </main>
      <Footer />
    </>
  );
}
