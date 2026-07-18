import type { ReactNode } from "react";

// Minimal renderer for the fixed markdown subset the Slate legal docs
// actually use (## headings, paragraphs, **bold**/*italic*, "- " lists, a
// lone "---" rule, and a whole-paragraph italic disclaimer) — no markdown
// dependency needed for a format this narrow, and avoids
// dangerouslySetInnerHTML entirely.
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${i++}`}>{match[1]}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-${i++}`}>{match[2]}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderLegalBody(markdown: string): ReactNode {
  const blocks = markdown.trim().split(/\n\s*\n/);

  return blocks.map((rawBlock, i) => {
    const block = rawBlock.trim();

    if (block === "---") {
      return <hr key={i} className="my-8 border-border" />;
    }

    if (block.startsWith("## ")) {
      return (
        <h2 key={i} className="text-base font-semibold text-text sm:text-lg">
          {parseInline(block.slice(3).trim(), `h${i}`)}
        </h2>
      );
    }

    const lines = block.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) {
      return (
        <ul key={i} className="list-disc space-y-1.5 pl-5">
          {lines.map((l, j) => (
            <li key={j}>{parseInline(l.slice(2).trim(), `li${i}-${j}`)}</li>
          ))}
        </ul>
      );
    }

    if (block.startsWith("*") && block.endsWith("*") && !block.startsWith("**")) {
      return (
        <p key={i} className="text-xs italic text-text-tertiary">
          {parseInline(block.slice(1, -1), `p${i}`)}
        </p>
      );
    }

    return <p key={i}>{parseInline(lines.join(" "), `p${i}`)}</p>;
  });
}
