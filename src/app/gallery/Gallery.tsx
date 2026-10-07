"use client";

import styled from "styled-components";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";

type Panel = {
  title: string;
  caption: string;
  before: { src: string; alt: string };
  after: { src: string; alt: string };
};

export type GalleryPhoto = {
  id: string;
  url: string | null;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
};

const Head = styled.header`
  padding: clamp(120px, 15vh, 180px) 0 1rem;
  text-align: center;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: clamp(2rem, 5vw, 3rem);
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0.5rem 0;
  }
  p {
    color: ${({ theme }) => theme.colors.inkMuted};
    max-width: 60ch;
    margin: 0 auto;
  }
`;

const Grid = styled.div`
  display: grid;
  gap: 3rem;
`;

const PanelWrap = styled.article`
  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.4rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0 0 0.75rem;
  }
`;

const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const PhotoCard = styled.figure`
  margin: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  background: #f4f6fb;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  display: flex;
  flex-direction: column;
  img {
    width: 100%;
    height: 220px;
    object-fit: cover;
    display: block;
  }
  figcaption {
    padding: 0.6rem 0.8rem;
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.inkSoft};
  }
`;

const PhotoHead = styled.div`
  text-align: center;
  margin: 3rem auto 1rem;
  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
    font-size: clamp(1.4rem, 3vw, 2rem);
    margin: 0 0 0.4rem;
  }
  p {
    color: ${({ theme }) => theme.colors.inkMuted};
    max-width: 60ch;
    margin: 0 auto;
  }
`;

const EmptyNote = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.inkMuted};
  padding: 2rem 0;
  font-style: italic;
`;

export function Gallery({
  panels,
  photos = [],
}: {
  panels: Panel[];
  photos?: GalleryPhoto[];
}) {
  const visiblePhotos = photos.filter((p) => p.url);
  return (
    <>
      <Head>
        <Container>
          <SectionLabel>Before and after</SectionLabel>
          <h1>What changed, drag to see</h1>
          <p>
            Drag the slider on each image to compare the site before and
            after. Our safeguarding policy keeps identifiable children out of
            these frames — the captions tell you what you&apos;re looking at.
          </p>
        </Container>
      </Head>
      <Section>
        <Container>
          <Grid>
            {panels.map((p) => (
              <PanelWrap key={p.title}>
                <h2>{p.title}</h2>
                <BeforeAfterSlider before={p.before} after={p.after} caption={p.caption} />
              </PanelWrap>
            ))}
          </Grid>

          <PhotoHead>
            <SectionLabel>From the field</SectionLabel>
            <h2>Photo library</h2>
            <p>
              Photographs uploaded and reviewed by the team — released
              publicly in line with our safeguarding policy.
            </p>
          </PhotoHead>
          {visiblePhotos.length === 0 ? (
            <EmptyNote>
              No public photos have been published yet. Upload and mark images
              as public in the admin media library to see them here.
            </EmptyNote>
          ) : (
            <PhotoGrid>
              {visiblePhotos.map((photo) => (
                <PhotoCard key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url ?? ""} alt={photo.alt ?? ""} loading="lazy" />
                  {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
                </PhotoCard>
              ))}
            </PhotoGrid>
          )}
        </Container>
      </Section>
    </>
  );
}
