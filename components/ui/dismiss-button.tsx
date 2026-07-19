/**
 * Shared "×" dismiss button (AnnouncementBar, OnboardingChecklist,
 * HowSlateWorksCard). className is required rather than merged with a
 * default — the four call sites want genuinely different sizing/position/
 * hover treatment, and concatenating a baked-in default with a caller's
 * override risks the same Tailwind-cascade-order conflict PrivacyPill hit
 * (a later-defined utility silently winning regardless of source order).
 */
export function DismissButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void;
  label: string;
  className: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
