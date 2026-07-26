import { MarketingHeader } from "@/components/marketing/header";
import { WaitlistHero } from "@/components/marketing/waitlist-hero";
import { Problem } from "@/components/marketing/problem";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { MarketingFooter } from "@/components/marketing/footer";

/**
 * Pre-launch landing: one continuous dark cinematic canvas (fixed near-black
 * in both themes, matching the launch campaign) — hero with the floating
 * product scene, then problem → how it works → bento features → finale CTA.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#121214]">
      <MarketingHeader />
      <main className="flex-1">
        <WaitlistHero />
        <Problem />
        <HowItWorks />
        <FeatureGrid />
        <ClosingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
