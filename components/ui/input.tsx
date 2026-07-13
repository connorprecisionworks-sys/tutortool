import {
  InputHTMLAttributes,
  forwardRef,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
} from "react";
import clsx from "clsx";

const fieldBase =
  "w-full rounded-lg border border-border bg-surface px-3 h-9 text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:border-border-strong focus:ring-4 focus:ring-[var(--focus-ring)] disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx(fieldBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={clsx(fieldBase, "h-auto min-h-24 py-2", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={clsx(fieldBase, "pr-8 appearance-none", className)} {...props} />
  )
);
Select.displayName = "Select";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("mb-1.5 block text-sm font-medium text-text", className)}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx("mt-1.5 text-xs text-text-tertiary", className)} {...props} />;
}
