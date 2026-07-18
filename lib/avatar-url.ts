/** Public URL for an avatar storage path — the `avatars` bucket (C4) is public, so this is pure string construction, no signed URL or network round trip needed. */
export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/avatars/${encodedPath}`;
}
