export function WelcomeHero({ tutorName }: { tutorName: string }) {
  const firstName = tutorName.trim().split(/\s+/)[0] || tutorName;

  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Welcome to Slate</p>
      <h1 className="mt-3 text-2xl font-semibold text-text sm:text-3xl">Let&apos;s get you set up, {firstName}.</h1>
      <p className="mt-2 max-w-lg text-sm text-text-secondary">
        Run your business. Focus on what matters. A few quick steps and you&apos;ll be ready to send your
        first invoice.
      </p>
    </div>
  );
}
