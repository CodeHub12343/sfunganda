import Link from "next/link";

// =============================================================================
// Blueprint §14.6 — "Published videos appear on /videos, the home page's
// latest-video slot, and the linked project."
//
// Server component: fetches the top video (we only need one) and lets the
// client-side player handle playback. If no video is ready yet the
// section renders nothing — the rest of the landing page is intact.
// =============================================================================

type VideoRow = {
  id: string;
  title: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  hls_url: string | null;
  created_at: string;
};

async function fetchLatest(): Promise<VideoRow | null> {
  const origin = process.env.API_ORIGIN;
  if (!origin) return null;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 2000);
  try {
    const r = await fetch(`${origin}/v1/videos`, {
      signal: ctl.signal,
      headers: process.env.INTERNAL_PROXY_SECRET
        ? { "x-internal-secret": process.env.INTERNAL_PROXY_SECRET }
        : undefined,
      next: { revalidate: 300, tags: ["public:videos"] },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: VideoRow[] };
    return (j.data ?? []).find((v) => v.hls_url) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

export async function LatestVideoSlot() {
  const latest = await fetchLatest();
  if (!latest) return null;

  return (
    <section
      aria-label="Latest video"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "3rem 1.25rem",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "clamp(1.5rem, 3vw, 2.1rem)" }}>From the field</h2>
        <Link href="/videos" style={{ fontSize: "0.95rem" }}>
          All videos →
        </Link>
      </header>
      <Link
        href="/videos"
        aria-label={`Watch all videos — latest: ${latest.title}`}
        style={{
          display: "block",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          position: "relative",
          aspectRatio: "16 / 9",
        }}
      >
        {/* Native HLS works on Safari / iOS; other browsers see the poster
            and the "All videos →" link above opens the full player on
            /videos. Keeping this slot framework-independent means a
            missing hls.js never crashes the landing page build. */}
        <video
          src={latest.hls_url!}
          preload="none"
          controls
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          aria-label={latest.title}
        />
      </Link>
      <h3 style={{ margin: "0.75rem 0 0.25rem", fontSize: "1.15rem" }}>{latest.title}</h3>
      <small style={{ color: "#6b7280" }}>
        {new Date(latest.created_at).toLocaleDateString()} ·{" "}
        <Link href={`/videos#${latest.id}`}>Read in another language</Link>
      </small>
    </section>
  );
}
