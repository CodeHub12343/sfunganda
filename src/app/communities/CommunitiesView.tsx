"use client";

import dynamic from "next/dynamic";
import styled from "styled-components";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/States";

// Leaflet is browser-only; dynamic import with ssr:false keeps the build
// static and keeps the leaflet CSS off the main page bundle.
const LazyMap = dynamic(() => import("./CommunitiesMap").then((m) => m.CommunitiesMap), {
  ssr: false,
  loading: () => <MapSkeleton aria-busy="true">Loading map…</MapSkeleton>,
});

type CommunityItem = {
  slug: string;
  name: string;
  region_label: string;
  summary: string;
  active_projects: number;
};

type CommunityDetail = {
  slug: string;
  name: string;
  region_label: string;
  summary: string;
  public_lat: number | null;
  public_lng: number | null;
  businesses: Array<{ slug: string; name: string; kind: string; status: string }>;
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

const MapSkeleton = styled.div`
  min-height: 420px;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.colors.bgSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  color: ${({ theme }) => theme.colors.inkMuted};
`;

const Layout = styled.div`
  display: grid;
  gap: 2rem;
  @media (min-width: 900px) {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
`;

const List = styled.ol`
  padding: 0;
  margin: 0;
  list-style: none;
  display: grid;
  gap: 1rem;
`;

const CommunityCard = styled.article`
  padding: 1.25rem 1.5rem;
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  h3 {
    margin: 0 0 0.25rem;
    font-family: ${({ theme }) => theme.font.heading};
    color: ${({ theme }) => theme.colors.trustBlue};
  }
  p {
    margin: 0.25rem 0;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.92rem;
  }
  span {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const Note = styled.p`
  margin-top: 1rem;
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: 0.85rem;
  max-width: 60ch;
`;

type Props = {
  items: CommunityItem[];
  details: CommunityDetail[];
};

export function CommunitiesView({ items, details }: Props) {
  const detailBySlug = new Map(details.map((d) => [d.slug, d]));
  const markers = details
    .filter((d) => d.public_lat !== null && d.public_lng !== null)
    .map((d) => ({
      slug: d.slug,
      name: d.name,
      lat: d.public_lat as number,
      lng: d.public_lng as number,
      businesses: d.businesses.length,
    }));

  return (
    <>
      <Head>
        <Container>
          <SectionLabel>Where we work</SectionLabel>
          <h1>Communities</h1>
          <p>
            The places Sarah&apos;s Foundation runs programmes. We publish
            only coarse coordinates to protect the children — the map pins
            below are intentionally rounded to one decimal.
          </p>
        </Container>
      </Head>
      <Section>
        <Container $wide>
          {items.length === 0 ? (
            <EmptyState title="No communities yet" />
          ) : (
            <>
              <Layout>
                <LazyMap markers={markers} />
                <List aria-label="Communities (list alternative to the map)">
                  {items.map((c) => {
                    const d = detailBySlug.get(c.slug);
                    return (
                      <li key={c.slug}>
                        <CommunityCard>
                          <h3>{c.name}</h3>
                          <p>{c.region_label}</p>
                          <p>{c.summary}</p>
                          <span>
                            {c.active_projects} active project
                            {c.active_projects === 1 ? "" : "s"}
                            {d && d.businesses.length > 0
                              ? ` · ${d.businesses.length} business${d.businesses.length === 1 ? "" : "es"}`
                              : ""}
                          </span>
                        </CommunityCard>
                      </li>
                    );
                  })}
                </List>
              </Layout>
              <Note>
                Coordinates on this page are coarse — rounded to one decimal of
                latitude and longitude (roughly 11 km of uncertainty). We never
                publish precise locations of children&apos;s homes.
              </Note>
            </>
          )}
        </Container>
      </Section>
    </>
  );
}
