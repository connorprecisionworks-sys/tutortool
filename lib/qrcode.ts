import QRCode from "qrcode";

/**
 * Renders a join link as an inline SVG string server-side — no client JS or
 * canvas needed, works the same in the app and in the email template.
 * Colors match the Slate palette (near-black on off-white) rather than the
 * library's pure black/white default.
 */
export async function generateJoinQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, {
    type: "svg",
    margin: 1,
    color: { dark: "#161616", light: "#f7f7f7" },
  });
}
