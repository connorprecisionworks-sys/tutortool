"use client";

import Link from "next/link";

export function AgreementCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        id="agree"
        name="agree"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
      />
      <label htmlFor="agree" className="text-sm text-text-secondary">
        I agree to the{" "}
        <Link
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-text"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-text"
        >
          Privacy Policy
        </Link>
        .
      </label>
    </div>
  );
}
