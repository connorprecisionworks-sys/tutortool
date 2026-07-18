import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-150 disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-4 motion-safe:hover:-translate-y-0.5";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-text hover:opacity-90 focus-visible:ring-[var(--focus-ring)]",
  secondary: "border border-border text-text hover:bg-hover focus-visible:ring-[var(--focus-ring)]",
  ghost: "text-text-secondary hover:bg-hover hover:text-text focus-visible:ring-[var(--focus-ring)]",
  danger: "border border-border text-text hover:bg-hover focus-visible:ring-[var(--focus-ring)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
