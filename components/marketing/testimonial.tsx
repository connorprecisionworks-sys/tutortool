// TODO(connor): Slate has no customers yet. Once a real tutor gives you a
// quote you can use, fill in TESTIMONIAL below and flip SHOW_TESTIMONIAL to
// true. Do not fabricate a quote, name, or metric in the meantime — leave
// this section hidden.
const SHOW_TESTIMONIAL = false;

const TESTIMONIAL = {
  quote: "",
  name: "",
  role: "",
  metric: "",
};

export function TestimonialSlot() {
  if (!SHOW_TESTIMONIAL) return null;

  return (
    <section className="border-t border-border px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xl tracking-tight sm:text-2xl">&ldquo;{TESTIMONIAL.quote}&rdquo;</p>
        <p className="mt-5 text-sm text-text-secondary">
          {TESTIMONIAL.name} — {TESTIMONIAL.role}
        </p>
        <p className="mt-2 text-sm font-semibold text-accent">{TESTIMONIAL.metric}</p>
      </div>
    </section>
  );
}
