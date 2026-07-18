import { readFileSync } from "node:fs";
import path from "node:path";

export interface LegalDoc {
  title: string;
  effectiveDate: string;
  version: string;
  body: string;
}

// Parses the fixed structure every Slate legal doc follows: "# Title" on
// line 1, then "**Effective Date:** ..." and "**Version:** ..." lines,
// then the body. Reading straight from legal/*.md (not a duplicated
// constant) is the point — bump the Effective Date/Version in the .md and
// every page/gate that cares picks it up automatically.
function parseLegalDoc(raw: string): LegalDoc {
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const effectiveMatch = raw.match(/^\*\*Effective Date:\*\*\s*(.+)$/m);
  const versionMatch = raw.match(/^\*\*Version:\*\*\s*(.+)$/m);

  // Removes only the three known header lines, each anchored to the whole
  // line (^...$/m) so a later line that happens to start with the same
  // "**Version:**"/"**Effective Date:**" text (e.g. a future in-doc
  // changelog bullet) can't be matched/stripped instead — .replace()
  // without a `g` flag always takes the first match, and the header lines
  // are always first in the document, so the anchor alone is sufficient.
  // Deliberately not slicing at the Version line's end instead: that would
  // silently swallow any future content placed between the title and
  // Version lines (e.g. a subtitle), not just these three known lines.
  const body = raw
    .replace(/^#\s+.+$/m, "")
    .replace(/^\*\*Effective Date:\*\*.+$/m, "")
    .replace(/^\*\*Version:\*\*.+$/m, "")
    .trim();

  return {
    title: titleMatch?.[1].trim() ?? "",
    effectiveDate: effectiveMatch?.[1].trim() ?? "",
    version: versionMatch?.[1].trim() ?? "",
    body,
  };
}

function readLegalDoc(filename: string): LegalDoc {
  const raw = readFileSync(path.join(process.cwd(), "legal", filename), "utf8");
  return parseLegalDoc(raw);
}

export const TERMS_DOC = readLegalDoc("Slate-Terms-of-Service.md");
export const PRIVACY_DOC = readLegalDoc("Slate-Privacy-Policy.md");
