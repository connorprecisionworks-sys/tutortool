import { Fragment } from "react";

/**
 * Splits text into words, each rising and fading in with a small stagger.
 * No IntersectionObserver — this is only used above the fold, where it's
 * already in view at mount. Reduced-motion visitors never get the
 * `motion-safe:animate-[...]` class, so words render at full opacity immediately.
 */
export function AnimatedHeadline({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span
            className="inline-block motion-safe:animate-[word-rise_0.6s_ease-out_both]"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {word}
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
