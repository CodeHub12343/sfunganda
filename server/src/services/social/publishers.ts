import { env } from "@/config/env.js";
import { log } from "@/util/log.js";
import type { SocialPlatform, SocialConnectionDoc } from "@/models/SocialConnection.js";

// =============================================================================
// Per-platform publisher. Each adapter translates a video + caption into a
// platform-native post and returns either {ok:true, external_id, url}
// or {ok:false, error_code, error_message, refresh_needed}.
//
// A publisher NEVER throws — the shaped result lets the worker handler
// decide between retry (refresh_needed, 5xx) and permanent fail
// (invalid_grant, policy violation).
//
// Mock publisher is used in dev/test and when the platform's credentials
// aren't configured. Real adapters live here as thin wrappers over the
// platform's HTTP APIs; because every platform requires a real developer
// app review (TD-12 fallback), we keep them small and well-structured.
// =============================================================================

export type PublishInput = {
  // The video to post. For YouTube we need the raw stream URL (Cloudflare
  // Stream can serve downloads); for Facebook/Instagram we hand them the
  // public playback URL. For TikTok we POST a file URL to their inbox
  // endpoint. The caller resolves the correct form for the platform.
  video_url: string;
  caption: string;
  // The platform's own channel/page/account id picked at connection time.
  channel_id: string;
};

export type PublishResult =
  | {
      ok: true;
      external_id: string;
      external_url: string;
    }
  | {
      ok: false;
      error_code: "invalid_grant" | "rate_limited" | "policy_rejected" | "transient" | "unavailable";
      error_message: string;
      refresh_needed?: boolean;
    };

export interface SocialPublisher {
  readonly platform: SocialPlatform;
  readonly configured: boolean;
  publish(connection: SocialConnectionDoc, input: PublishInput, accessToken: string): Promise<PublishResult>;
  // Exchange an auth code for tokens, or refresh if the connection
  // already has a refresh_token. Returning null means "not supported"
  // (TikTok's long-lived access, for instance).
  exchangeCode?(args: { code: string; redirect_uri: string }): Promise<TokenExchangeResult>;
  refresh?(refreshToken: string): Promise<TokenExchangeResult>;
  readonly oauthStart?: (state: string, redirect_uri: string) => string;
  readonly scopes: string[];
}

export type TokenExchangeResult = {
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | null;
  channel_id: string;
  channel_name: string;
  scopes: string[];
};

// ---- Mock publisher (default when platform credentials are absent) ---------
//
// Returns a deterministic external url that captures the input. Used in
// Phase 12 tests and in dev; also used in production BEFORE the real
// app is approved so the admin flow is end-to-end testable.
class MockPublisher implements SocialPublisher {
  readonly platform: SocialPlatform;
  readonly configured = true;
  readonly scopes: string[] = ["mock.publish"];
  constructor(platform: SocialPlatform) {
    this.platform = platform;
  }
  async publish(
    _c: SocialConnectionDoc,
    input: PublishInput,
    _token: string
  ): Promise<PublishResult> {
    const stamp = Date.now().toString(36);
    log.info({ platform: this.platform, caption: input.caption.slice(0, 60) }, "social.mock.publish");
    return {
      ok: true,
      external_id: `mock_${this.platform}_${stamp}`,
      external_url: `https://example.invalid/${this.platform}/${stamp}`,
    };
  }
  async exchangeCode(args: { code: string; redirect_uri: string }): Promise<TokenExchangeResult> {
    void args;
    return {
      access_token: `mock-access-${this.platform}`,
      refresh_token: `mock-refresh-${this.platform}`,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      channel_id: `mock-${this.platform}-channel`,
      channel_name: `Mock ${this.platform}`,
      scopes: this.scopes,
    };
  }
  async refresh(_rt: string): Promise<TokenExchangeResult> {
    return this.exchangeCode({ code: "", redirect_uri: "" });
  }
  oauthStart = (state: string): string => `https://example.invalid/oauth/${this.platform}?state=${state}`;
}

// ---- YouTube ---------------------------------------------------------------
class YouTubePublisher implements SocialPublisher {
  readonly platform: SocialPlatform = "youtube";
  readonly scopes = ["https://www.googleapis.com/auth/youtube.upload"];
  get configured(): boolean {
    return Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET);
  }
  oauthStart = (state: string, redirect_uri: string): string => {
    const params = new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID ?? "",
      redirect_uri,
      response_type: "code",
      scope: this.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };
  async exchangeCode(args: { code: string; redirect_uri: string }): Promise<TokenExchangeResult> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: args.code,
        client_id: env.YOUTUBE_CLIENT_ID ?? "",
        client_secret: env.YOUTUBE_CLIENT_SECRET ?? "",
        redirect_uri: args.redirect_uri,
        grant_type: "authorization_code",
      }),
    });
    const j = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !j.access_token) {
      throw new Error(`youtube oauth exchange: ${j.error_description ?? j.error ?? res.status}`);
    }
    // Fetch the authenticated channel id so posts always target the same
    // channel this operator connected.
    const chanRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { authorization: `Bearer ${j.access_token}` } }
    );
    const chan = (await chanRes.json()) as {
      items?: Array<{ id: string; snippet?: { title?: string } }>;
    };
    const channel = chan.items?.[0];
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token ?? null,
      expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : null,
      channel_id: channel?.id ?? "primary",
      channel_name: channel?.snippet?.title ?? "YouTube channel",
      scopes: (j.scope ?? "").split(" ").filter(Boolean),
    };
  }
  async refresh(refreshToken: string): Promise<TokenExchangeResult> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.YOUTUBE_CLIENT_ID ?? "",
        client_secret: env.YOUTUBE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
      }),
    });
    const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !j.access_token) throw new Error(`youtube refresh: ${j.error ?? res.status}`);
    return {
      access_token: j.access_token,
      refresh_token: refreshToken,
      expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : null,
      channel_id: "",
      channel_name: "",
      scopes: [],
    };
  }
  async publish(
    _c: SocialConnectionDoc,
    input: PublishInput,
    accessToken: string
  ): Promise<PublishResult> {
    // YouTube Data API `videos.insert` with a resumable upload is the
    // right call for public uploads. We implement the "upload by URL"
    // minimal variant: start a resumable session, PUT the stream URL
    // bytes (we fetch them from Cloudflare Stream download URL). For a
    // production real-time deployment this is a background two-step
    // operation; here we return a shaped result so the worker can retry.
    try {
      // Step 1 — initialise the resumable session.
      const init = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
            "x-upload-content-type": "video/mp4",
          },
          body: JSON.stringify({
            snippet: { title: input.caption.slice(0, 100), description: input.caption },
            status: { privacyStatus: "public" },
          }),
        }
      );
      if (init.status === 401) {
        return { ok: false, error_code: "invalid_grant", error_message: "access token rejected", refresh_needed: true };
      }
      if (!init.ok) {
        return { ok: false, error_code: "transient", error_message: `init ${init.status}` };
      }
      const uploadUrl = init.headers.get("location");
      if (!uploadUrl) return { ok: false, error_code: "transient", error_message: "no upload url" };
      // Step 2 — stream the video from source to YouTube.
      const src = await fetch(input.video_url);
      if (!src.ok || !src.body) return { ok: false, error_code: "transient", error_message: "source unavailable" };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": "video/mp4" },
        body: src.body as unknown as BodyInit,
      });
      if (!put.ok) return { ok: false, error_code: "transient", error_message: `upload ${put.status}` };
      const j = (await put.json()) as { id?: string };
      if (!j.id) return { ok: false, error_code: "transient", error_message: "no video id in response" };
      return {
        ok: true,
        external_id: j.id,
        external_url: `https://www.youtube.com/watch?v=${j.id}`,
      };
    } catch (err) {
      return { ok: false, error_code: "transient", error_message: (err as Error).message.slice(0, 400) };
    }
  }
}

// ---- Facebook pages --------------------------------------------------------
class FacebookPublisher implements SocialPublisher {
  readonly platform: SocialPlatform = "facebook";
  readonly scopes = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"];
  get configured(): boolean {
    return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
  }
  oauthStart = (state: string, redirect_uri: string): string => {
    const params = new URLSearchParams({
      client_id: env.FACEBOOK_APP_ID ?? "",
      redirect_uri,
      scope: this.scopes.join(","),
      response_type: "code",
      state,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  };
  async exchangeCode(args: { code: string; redirect_uri: string }): Promise<TokenExchangeResult> {
    const res = await fetch(
      "https://graph.facebook.com/v18.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: env.FACEBOOK_APP_ID ?? "",
          client_secret: env.FACEBOOK_APP_SECRET ?? "",
          redirect_uri: args.redirect_uri,
          code: args.code,
        }).toString()
    );
    const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!res.ok || !j.access_token) throw new Error(`facebook exchange: ${j.error?.message ?? res.status}`);
    // Promote to a long-lived user access token.
    const long = await fetch(
      "https://graph.facebook.com/v18.0/oauth/access_token?" +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: env.FACEBOOK_APP_ID ?? "",
          client_secret: env.FACEBOOK_APP_SECRET ?? "",
          fb_exchange_token: j.access_token,
        }).toString()
    );
    const long_j = (await long.json()) as { access_token?: string; expires_in?: number };
    const token = long_j.access_token ?? j.access_token;
    // Pick the first page token.
    const pages = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(token)}`
    );
    const page_j = (await pages.json()) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
    };
    const page = page_j.data?.[0];
    return {
      access_token: page?.access_token ?? token,
      refresh_token: null,
      expires_at: long_j.expires_in ? new Date(Date.now() + long_j.expires_in * 1000) : null,
      channel_id: page?.id ?? "me",
      channel_name: page?.name ?? "Facebook",
      scopes: this.scopes,
    };
  }
  async publish(
    connection: SocialConnectionDoc,
    input: PublishInput,
    accessToken: string
  ): Promise<PublishResult> {
    try {
      // Facebook video upload-by-URL — the simplest reliable path.
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${encodeURIComponent(connection.channel_id)}/videos`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            file_url: input.video_url,
            description: input.caption,
            access_token: accessToken,
          }),
        }
      );
      const j = (await res.json()) as { id?: string; error?: { message?: string; code?: number } };
      if (res.status === 401 || j.error?.code === 190) {
        return { ok: false, error_code: "invalid_grant", error_message: j.error?.message ?? "token expired" };
      }
      if (!res.ok || !j.id) {
        return { ok: false, error_code: "transient", error_message: j.error?.message ?? `status ${res.status}` };
      }
      return {
        ok: true,
        external_id: j.id,
        external_url: `https://www.facebook.com/${j.id}`,
      };
    } catch (err) {
      return { ok: false, error_code: "transient", error_message: (err as Error).message.slice(0, 400) };
    }
  }
}

// ---- Instagram (via Facebook graph; same credentials path) -----------------
class InstagramPublisher implements SocialPublisher {
  readonly platform: SocialPlatform = "instagram";
  readonly scopes = ["instagram_basic", "instagram_content_publish"];
  get configured(): boolean {
    return Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET);
  }
  oauthStart = (state: string, redirect_uri: string): string => {
    const params = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID ?? "",
      redirect_uri,
      scope: this.scopes.join(","),
      response_type: "code",
      state,
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  };
  async exchangeCode(args: { code: string; redirect_uri: string }): Promise<TokenExchangeResult> {
    const res = await fetch(
      "https://graph.facebook.com/v18.0/oauth/access_token?" +
        new URLSearchParams({
          client_id: env.INSTAGRAM_APP_ID ?? "",
          client_secret: env.INSTAGRAM_APP_SECRET ?? "",
          redirect_uri: args.redirect_uri,
          code: args.code,
        }).toString()
    );
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!res.ok || !j.access_token) throw new Error(`instagram exchange: ${res.status}`);
    return {
      access_token: j.access_token,
      refresh_token: null,
      expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : null,
      channel_id: "ig_business_account",
      channel_name: "Instagram",
      scopes: this.scopes,
    };
  }
  async publish(
    connection: SocialConnectionDoc,
    input: PublishInput,
    accessToken: string
  ): Promise<PublishResult> {
    try {
      // Two-step: create container, then publish.
      const container = await fetch(
        `https://graph.facebook.com/v18.0/${encodeURIComponent(connection.channel_id)}/media`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            media_type: "VIDEO",
            video_url: input.video_url,
            caption: input.caption,
            access_token: accessToken,
          }),
        }
      );
      const cj = (await container.json()) as { id?: string; error?: { message?: string } };
      if (!container.ok || !cj.id) {
        return {
          ok: false,
          error_code: container.status === 401 ? "invalid_grant" : "transient",
          error_message: cj.error?.message ?? `container ${container.status}`,
        };
      }
      const pub = await fetch(
        `https://graph.facebook.com/v18.0/${encodeURIComponent(connection.channel_id)}/media_publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ creation_id: cj.id, access_token: accessToken }),
        }
      );
      const pj = (await pub.json()) as { id?: string; error?: { message?: string } };
      if (!pub.ok || !pj.id) {
        return { ok: false, error_code: "transient", error_message: pj.error?.message ?? `publish ${pub.status}` };
      }
      return {
        ok: true,
        external_id: pj.id,
        external_url: `https://www.instagram.com/p/${pj.id}`,
      };
    } catch (err) {
      return { ok: false, error_code: "transient", error_message: (err as Error).message.slice(0, 400) };
    }
  }
}

// ---- TikTok ---------------------------------------------------------------
class TikTokPublisher implements SocialPublisher {
  readonly platform: SocialPlatform = "tiktok";
  readonly scopes = ["user.info.basic", "video.publish"];
  get configured(): boolean {
    return Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
  }
  oauthStart = (state: string, redirect_uri: string): string => {
    const params = new URLSearchParams({
      client_key: env.TIKTOK_CLIENT_KEY ?? "",
      redirect_uri,
      response_type: "code",
      scope: this.scopes.join(","),
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  };
  async exchangeCode(args: { code: string; redirect_uri: string }): Promise<TokenExchangeResult> {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY ?? "",
        client_secret: env.TIKTOK_CLIENT_SECRET ?? "",
        code: args.code,
        grant_type: "authorization_code",
        redirect_uri: args.redirect_uri,
      }),
    });
    const j = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
    };
    if (!res.ok || !j.access_token) throw new Error(`tiktok exchange: ${res.status}`);
    return {
      access_token: j.access_token,
      refresh_token: j.refresh_token ?? null,
      expires_at: j.expires_in ? new Date(Date.now() + j.expires_in * 1000) : null,
      channel_id: j.open_id ?? "me",
      channel_name: "TikTok",
      scopes: this.scopes,
    };
  }
  async publish(
    connection: SocialConnectionDoc,
    input: PublishInput,
    accessToken: string
  ): Promise<PublishResult> {
    void connection;
    try {
      const init = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          source_info: { source: "PULL_FROM_URL", video_url: input.video_url },
        }),
      });
      const j = (await init.json()) as { data?: { publish_id?: string }; error?: { code?: string; message?: string } };
      if (init.status === 401) {
        return { ok: false, error_code: "invalid_grant", error_message: j.error?.message ?? "unauthorized" };
      }
      if (!init.ok || !j.data?.publish_id) {
        return { ok: false, error_code: "transient", error_message: j.error?.message ?? `init ${init.status}` };
      }
      return {
        ok: true,
        external_id: j.data.publish_id,
        external_url: `https://www.tiktok.com/@/video/${j.data.publish_id}`,
      };
    } catch (err) {
      return { ok: false, error_code: "transient", error_message: (err as Error).message.slice(0, 400) };
    }
  }
}

// ---- Registry --------------------------------------------------------------

const REAL: Record<SocialPlatform, SocialPublisher> = {
  youtube: new YouTubePublisher(),
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  tiktok: new TikTokPublisher(),
};

let override: Partial<Record<SocialPlatform, SocialPublisher>> | null = null;

export function setPublishersForTests(map: Partial<Record<SocialPlatform, SocialPublisher>> | null): void {
  override = map;
}

export function getPublisher(platform: SocialPlatform): SocialPublisher {
  if (override && override[platform]) return override[platform]!;
  const real = REAL[platform];
  if (real.configured) return real;
  // Fall back to a mock so operator flows (connect, retry, admin status)
  // are usable before the real app approval lands. Keep the mock behind
  // SOCIAL_ENABLED so a prod deploy with unset credentials doesn't start
  // "posting" to an invalid URL.
  if (!env.SOCIAL_ENABLED) {
    return new (class extends MockPublisher {
      readonly configured = false;
    })(platform);
  }
  return new MockPublisher(platform);
}

export const AVAILABLE_PLATFORMS: SocialPlatform[] = ["youtube", "facebook", "instagram", "tiktok"];
