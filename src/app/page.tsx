import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { StickyDonate } from "@/components/layout/StickyDonate";
import { DonationStatus } from "@/components/layout/DonationStatus";
import { Hero } from "@/components/sections/Hero";
import { ImpactCounter } from "@/components/sections/ImpactCounter";
import { OurStory } from "@/components/sections/OurStory";
import { AreasOfImpact } from "@/components/sections/AreasOfImpact";
import { ImpactMap } from "@/components/sections/ImpactMap";
import { FeaturedStories } from "@/components/sections/FeaturedStories";
import { OrphanageHub } from "@/components/sections/OrphanageHub";
import { SponsorChild } from "@/components/sections/SponsorChild";
import { Volunteer } from "@/components/sections/Volunteer";
import { Transparency } from "@/components/sections/Transparency";
import { Testimonials } from "@/components/sections/Testimonials";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ImpactCounter />
        <OurStory />
        <AreasOfImpact />
        <ImpactMap />
        <FeaturedStories />
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
