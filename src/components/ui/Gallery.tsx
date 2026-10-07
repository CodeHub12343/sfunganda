"use client";

import Image from "next/image";
import { useState } from "react";
import styled from "styled-components";
import { Lightbox } from "./Lightbox";

export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string | null;
};

const Grid = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
`;

const Tile = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  margin: 0;
  background: none;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  cursor: zoom-in;
  position: relative;
  aspect-ratio: 1 / 1;
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.sunriseOrange};
    outline-offset: 3px;
  }
  img {
    object-fit: cover;
  }
`;

export function Gallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return <p>No images yet.</p>;
  return (
    <>
      <Grid>
        {items.map((it, i) => (
          <li key={it.id}>
            <Tile aria-label={it.alt} onClick={() => setOpen(i)}>
              <Image
                src={it.src}
                alt={it.alt}
                fill
                sizes="(max-width: 720px) 50vw, 220px"
                placeholder="empty"
              />
            </Tile>
          </li>
        ))}
      </Grid>
      {open !== null ? (
        <Lightbox
          items={items}
          index={open}
          onClose={() => setOpen(null)}
          onNavigate={(i) => setOpen(i)}
        />
      ) : null}
    </>
  );
}
