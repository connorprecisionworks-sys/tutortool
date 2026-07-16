import {
  MarketingHeader,
  Hero,
  Problem,
  Features,
  HowItWorks,
  ClosingCta,
  MarketingFooter,
} from "@/components/marketing/sections";

export default function LandingPage() {
  const calcomLink = process.env.CALCOM_LINK || "https://cal.com/";

  return (
    <div className="flex min-h-full flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <Hero calcomLink={calcomLink} />
        <Problem />
        <Features />
        <HowItWorks />
        <ClosingCta />
      </main>
      <MarketingFooter calcomLink={calcomLink} />
    </div>
  );
}
