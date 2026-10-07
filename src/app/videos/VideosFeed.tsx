"use client";

import styled from "styled-components";
import { Container, Section } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { VideoPlayer } from "@/components/ui/VideoPlayer";
import { VideoSummaryPicker } from "@/components/ai/VideoSummaryPicker";

export type VideoRow = {
  id: string;
  title: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  hls_url: string | null;
  created_at: string;
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
`;

const Card = styled.article`
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadow.soft};
  overflow: hidden;
`;

const PlayerWrap = styled.div`
  background: #000;
  aspect-ratio: 16 / 9;
  & > * {
    width: 100%;
    height: 100%;
  }
`;

const Body = styled.div`
  padding: 1rem 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  h2 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 1.1rem;
    color: ${({ theme }) => theme.colors.trustBlue};
    margin: 0;
  }
  time {
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.82rem;
  }
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const DurationChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.72rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.inkSoft};
  background: #f1f4fa;
  border-radius: 999px;
  letter-spacing: 0.02em;
`;

const EmptyNote = styled.p`
  text-align: center;
  color: ${({ theme }) => theme.colors.inkMuted};
  padding: 2rem 0;
  font-style: italic;
`;

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideosFeed({ videos }: { videos: VideoRow[] }) {
  const playable = videos.filter((v) => v.hls_url);
  return (
    <>
      <Head>
        <Container>
          <SectionLabel>From the field</SectionLabel>
          <h1>Videos from the people doing the work</h1>
          <p>
            Short films filmed and reviewed by our team on the ground. We
            publish them in line with our safeguarding policy — what you see
            here is what we&apos;re happy for the whole world to see.
          </p>
        </Container>
      </Head>
      <Section>
        <Container>
          {playable.length === 0 ? (
            <EmptyNote>
              No videos have been published yet. Check back soon, or upload one
              from the admin media library.
            </EmptyNote>
          ) : (
            <Grid>
              {playable.map((v) => {
                const duration = formatDuration(v.duration_seconds);
                return (
                  <Card key={v.id}>
                    <PlayerWrap>
                      {v.hls_url ? (
                        <VideoPlayer hlsUrl={v.hls_url} caption={v.title} />
                      ) : null}
                    </PlayerWrap>
                    <Body>
                      <h2>{v.title}</h2>
                      <MetaRow>
                        <time dateTime={v.created_at}>
                          {new Date(v.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </time>
                        {duration ? <DurationChip>{duration}</DurationChip> : null}
                      </MetaRow>
                      <VideoSummaryPicker videoId={v.id} />
                    </Body>
                  </Card>
                );
              })}
            </Grid>
          )}
        </Container>
      </Section>
    </>
  );
}
