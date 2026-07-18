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
  const effectiveMatch = raw.match(/\*\*Effective Date:\*\*\s*(.+)/);
  const versionMatch = raw.match(/\*\*Version:\*\*\s*(.+)/);

  const body = raw
    .replace(/^#\s+.+$/m, "")
    .replace(/\*\*Effective Date:\*\*.+/, "")
    .replace(/\*\*Version:\*\*.+/, "")
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
