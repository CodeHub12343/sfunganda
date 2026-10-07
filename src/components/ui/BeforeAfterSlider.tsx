"use client";

import { useCallback, useId, useRef, useState } from "react";
import styled from "styled-components";

// =============================================================================
// Accessible before/after image slider (Phase 8).
//
// Interaction:
//   • Mouse / touch — drag the handle.
//   • Keyboard — tab to the handle (a visible slider thumb), use arrow keys
//     to move 2 % per press, Home/End for 0/100. The thumb carries a native
//     ARIA slider role so screen readers announce the current percentage.
//
// Accessibility rules (§Phase 8 testing: "slider keyboard operation"):
//   • Both images carry an alt text — a caption is NOT a substitute.
//   • The slider has role=slider, aria-valuemin/max/now, aria-label.
//   • No motion in reduced-motion mode: the handle snaps rather than tweens.
// =============================================================================

const Wrap = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.lg};
  user-select: none;
  background: ${({ theme }) => theme.colors.bgSoft};
`;

const Image = styled.img`
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none;
`;

const AfterLayer = styled.div<{ $pct: number }>`
  position: absolute;
  inset: 0;
  overflow: hidden;
  width: ${({ $pct }) => $pct}%;
  will-change: width;
  img {
    width: ${({ $pct }) => (100 / $pct) * 100}%;
    max-width: none;
  }
`;

const HandleTrack = styled.div`
  position: absolute;
  inset: 0;
  cursor: ew-resize;
`;

const Handle = styled.button<{ $pct: number }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${({ $pct }) => $pct}%;
  transform: translateX(-50%);
  width: 44px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: ew-resize;
  &::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #fff;
    transform: translateX(-50%);
    box-shadow: 0 0 0 1px rgba(7, 17, 29, 0.3);
  }
  &::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: #fff;
    transform: translate(-50%, -50%);
    box-shadow: 0 2px 10px rgba(7, 17, 29, 0.35);
  }
  &:focus-visible {
    outline: none;
    &::after {
      box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.sunriseOrange};
    }
  }
`;

const Caption = styled.p`
  margin-top: 0.75rem;
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.9rem;
`;

type Props = {
  before: { src: string; alt: string };
  after: { src: string; alt: string };
  caption?: string;
  initial?: number;
};

export function BeforeAfterSlider({ before, after, caption, initial = 50 }: Props) {
  const [pct, setPct] = useState(Math.min(100, Math.max(0, initial)));
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sliderId = useId();

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const next = Math.min(100, Math.max(0, (x / rect.width) * 100));
    setPct(Math.round(next));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    setFromClientX(e.clientX);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        setPct((p) => Math.max(0, p - (e.shiftKey ? 10 : 2)));
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        setPct((p) => Math.min(100, p + (e.shiftKey ? 10 : 2)));
        break;
      case "Home":
        e.preventDefault();
        setPct(0);
        break;
      case "End":
        e.preventDefault();
        setPct(100);
        break;
    }
  };

  return (
    <div>
      <Wrap
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        aria-describedby={caption ? `${sliderId}-caption` : undefined}
      >
        <Image src={before.src} alt={before.alt} />
        <AfterLayer $pct={pct} aria-hidden="true">
          <Image src={after.src} alt={after.alt} aria-hidden="true" />
        </AfterLayer>
        <HandleTrack aria-hidden="true" />
        <Handle
          type="button"
          $pct={pct}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct} percent after`}
          aria-label="Before and after slider"
          onKeyDown={onKeyDown}
        />
      </Wrap>
      {caption ? <Caption id={`${sliderId}-caption`}>{caption}</Caption> : null}
    </div>
  );
}
