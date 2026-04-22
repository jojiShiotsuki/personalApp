// Parse a Content-Disposition header and return the `filename` parameter,
// or null if absent. Handles both quoted (filename="foo.csv") and unquoted
// (filename=foo.csv) forms. Does NOT handle RFC 5987 `filename*=` extended
// syntax — we don't emit it server-side and ASCII-only filenames suffice
// for the cold-call CSV use case (slug is alphanumerics + dashes + date).
export function parseFilenameFromContentDisposition(
  header: string | undefined | null
): string | null {
  if (!header) return null;

  // Quoted form first: filename="foo bar.csv"
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted) return quoted[1];

  // Unquoted: filename=foo.csv (stops at ; or end-of-string)
  const unquoted = header.match(/filename=([^;]+)/i);
  if (unquoted) return unquoted[1].trim();

  return null;
}
