import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { MarketingHeader } from "@/components/marketing/header";
import { Hero } from "@/components/marketing/hero";
import { CapabilityMarquee } from "@/components/marketing/marquee";
import { ProductOverview } from "@/components/marketing/product-overview";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { TestimonialSlot } from "@/components/marketing/testimonial";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { MarketingFooter } from "@/components/marketing/footer";

export default function LandingPage() {
  const calcomLink = process.env.CALCOM_LINK || "https://cal.com/slatetutor";

  return (
    <div className="flex min-h-full flex-col">
      <AnnouncementBar message="New in Slate: send a booking link and get paid in one flow." />
      <MarketingHeader />
      <main className="flex-1">
        <Hero />
        <CapabilityMarquee />
        <ProductOverview />
        <HowItWorks />
        <FeatureGrid />
        <TestimonialSlot />
        <ClosingCta calcomLink={calcomLink} />
      </main>
      <MarketingFooter calcomLink={calcomLink} />
    </div>
  );
}
