"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";

const Frame = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  video {
    width: 100%;
    height: 100%;
    display: block;
  }
`;

type Props = {
  hlsUrl: string;
  poster?: string;
  caption?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
};

export function VideoPlayer({ hlsUrl, poster, caption, autoPlay, muted }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Safari supports HLS natively; other browsers need hls.js. We attach
    // it only when needed and don't ship the lib for the Safari majority.
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = hlsUrl;
      return;
    }
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
    import("hls.js")
      .then((mod) => {
        if (destroyed) return;
        const Hls = mod.default as unknown as new (opts?: Record<string, unknown>) => {
          loadSource: (u: string) => void;
          attachMedia: (v: HTMLVideoElement) => void;
          destroy: () => void;
          on: (ev: string, cb: () => void) => void;
        } & { Events: { ERROR: string } };
        const inst = new Hls();
        inst.loadSource(hlsUrl);
        inst.attachMedia(el);
        hls = inst as unknown as { destroy: () => void };
      })
      .catch(() => {
        // Fall back to progressive URL if hls.js isn't present. We still
        // give the user a visible attempt rather than a blank frame.
        el.src = hlsUrl;
      });
    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [hlsUrl]);

  return (
    <Frame>
      <video
        ref={ref}
        controls
        playsInline
        preload="metadata"
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        aria-label={caption ?? undefined}
      />
    </Frame>
  );
}
