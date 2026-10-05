import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Safeguarding",
  description:
    "How Sarah's Foundation protects the children in its care, including policies on imagery, naming, and consent.",
};

export default function SafeguardingPage() {
  return (
    <>
      <Navbar />
      <main>
        <LegalPage title="Safeguarding" updated="October 2026">
          <p>
            The safety and dignity of every child in our care is the first
            and non-negotiable test every programme decision must pass.
          </p>

          <h2>Our commitments</h2>
          <ul>
            <li>
              <strong>No naming.</strong> We do not publish the real names of
              children in our care on the public site, in social posts, or
              in appeals.
            </li>
            <li>
              <strong>No identifying imagery.</strong> Photographs of
              identifiable children are not used in marketing. Where imagery
              is needed, we use non-identifying photographs with consent, or
              illustrative imagery labelled as such.
            </li>
            <li>
              <strong>No invented stories.</strong> We never pair stock
              photography with invented names, ages, or first-person quotes.
              The programme-level descriptions on our Stories section are
              exactly that — descriptions of our work, not individuals.
            </li>
            <li>
              <strong>Consent, where real stories are shared.</strong> Any
              real story shared in the future requires verified consent from
              the child&apos;s guardian and a safeguarding review of the
              content before publication.
            </li>
            <li>
              <strong>Access.</strong> Only trained operations staff interact
              directly with the children. Visitors are supervised; no
              one-to-one unsupervised contact is permitted.
            </li>
          </ul>

          <h2>Reporting a concern</h2>
          <p>
            If you have a safeguarding concern — about a child in our
            programme, about the conduct of someone representing the
            foundation, or about anything you have seen on this site that you
            believe places a child at risk — please contact us immediately at{" "}
            <a href="mailto:hello@honestneed.com">hello@honestneed.com</a>.
          </p>
          <p>
            Concerns can be raised anonymously. We take every report
            seriously and respond within one working day.
          </p>

          <h2>Review</h2>
          <p>
            This policy is reviewed annually and whenever a material incident
            prompts change. The &quot;last updated&quot; date above reflects
            the most recent review.
          </p>
        </LegalPage>
      </main>
      <Footer />
    </>
  );
}
