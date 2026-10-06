import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StickyDonate } from "@/components/layout/StickyDonate";
import { DonationStatus } from "@/components/layout/DonationStatus";
import { Hero } from "@/components/sections/Hero";
import { ImpactCounter } from "@/components/sections/ImpactCounter";
import { LiveImpactCounter } from "@/components/sections/LiveImpactCounter";
import { OurStory } from "@/components/sections/OurStory";
import { LatestVideoSlot } from "@/components/sections/LatestVideoSlot";
import { AreasOfImpact } from "@/components/sections/AreasOfImpact";
import { ImpactMap } from "@/components/sections/ImpactMap";
import { FeaturedStories } from "@/components/sections/FeaturedStories";
import { LiveFeaturedStories } from "@/components/sections/LiveFeaturedStories";
import { OrphanageHub } from "@/components/sections/OrphanageHub";
import { SponsorChild } from "@/components/sections/SponsorChild";
import { Volunteer } from "@/components/sections/Volunteer";
import { Transparency } from "@/components/sections/Transparency";
import { Testimonials } from "@/components/sections/Testimonials";
import { FinalCTA } from "@/components/sections/FinalCTA";

// =============================================================================
// Landing page.
//
// This file is intentionally NOT async at the top level — every live
// section does its own fetching inside a <Suspense> boundary with the
// static fallback as the suspense fallback. That means:
//
//   • If the Express API at :4000 is down, Hero + the static fallbacks
//     render immediately. No await ever blocks the whole page.
//   • If a single live section's fetch is slow or throws, Suspense
//     catches it and shows the fallback for that one slot. The rest of
//     the page renders normally.
//
// Phase 10–13 landed here:
//   • <LiveImpactCounter>    — real approved counts + net donations.
//   • <LatestVideoSlot>      — home-page latest-video slot (§14.6).
//   • <LiveFeaturedStories>  — director-approved accomplishments, not
//                              invented programme copy.
//   • <Transparency>         — children's-fund suppressed aggregate.
//   • Branding is picked up by Hero via /public/branding on the server;
//     when the API isn't reachable Hero falls back to content.ts.
// =============================================================================

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Suspense fallback={<ImpactCounter />}>
          <LiveImpactCounter />
        </Suspense>
        <OurStory />
        <Suspense fallback={null}>
          <LatestVideoSlot />
        </Suspense>
        <AreasOfImpact />
        <ImpactMap />
        <Suspense fallback={<FeaturedStories />}>
          <LiveFeaturedStories />
        </Suspense>
        <OrphanageHub />
        <SponsorChild />
        <Volunteer />
        <Transparency />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
      <StickyDonate />
      <DonationStatus />
    </>
  );
}
