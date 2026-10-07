"use client";

import Image from "next/image";
import { useEffect } from "react";
import styled from "styled-components";
import type { GalleryItem } from "./Gallery";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.86);
  display: grid;
  place-items: center;
  z-index: 1000;
`;

const Stage = styled.div`
  position: relative;
  width: min(96vw, 1400px);
  height: min(90vh, 90vw);
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.4rem;
`;

const Nav = styled.button<{ $side: "left" | "right" }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $side }) => ($side === "left" ? "left: 1rem" : "right: 1rem")};
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.4rem;
`;

const Cap = styled.p`
  position: absolute;
  bottom: -2rem;
  left: 0;
  right: 0;
  text-align: center;
  color: #fff;
  font-size: 0.9rem;
`;

export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const cur = items[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % items.length);
      if (e.key === "ArrowLeft") onNavigate((index - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onNavigate]);

  if (!cur) return null;

  return (
    <Backdrop
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Stage>
        <Image src={cur.src} alt={cur.alt} fill sizes="100vw" style={{ objectFit: "contain" }} />
        <CloseBtn onClick={onClose} aria-label="Close">
          ×
        </CloseBtn>
        {items.length > 1 ? (
          <>
            <Nav
              $side="left"
              aria-label="Previous"
              onClick={() => onNavigate((index - 1 + items.length) % items.length)}
            >
              ‹
            </Nav>
            <Nav
              $side="right"
              aria-label="Next"
              onClick={() => onNavigate((index + 1) % items.length)}
            >
              ›
            </Nav>
          </>
        ) : null}
        {cur.caption ? <Cap>{cur.caption}</Cap> : null}
      </Stage>
    </Backdrop>
  );
}
