"use client";

import styled from "styled-components";
import { VideoPlayer } from "@/components/ui/VideoPlayer";

type VideoRow = {
  id: string;
  title: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  hls_url: string | null;
  created_at: string;
};

const Page = styled.main`
  max-width: 960px;
  margin: 0 auto;
  padding: 3rem 1.25rem 5rem;
  h1 {
    font-family: ${({ theme }) => theme.font.heading};
    font-size: 2.25rem;
    margin: 0 0 2rem;
  }
`;

const Card = styled.article`
  margin-bottom: 2.5rem;
  h2 {
    font-size: 1.1rem;
    margin: 0.6rem 0 0.2rem;
  }
  time {
    display: block;
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: 0.85rem;
  }
`;

export function VideosFeed({ videos }: { videos: VideoRow[] }) {
  return (
    <Page>
      <h1>Videos</h1>
      {videos.length === 0 ? (
        <p>No videos yet. Check back soon.</p>
      ) : (
        videos.map((v) => (
          <Card key={v.id}>
            {v.hls_url ? <VideoPlayer hlsUrl={v.hls_url} caption={v.title} /> : null}
            <h2>{v.title}</h2>
            <time dateTime={v.created_at}>{new Date(v.created_at).toLocaleDateString()}</time>
          </Card>
        ))
      )}
    </Page>
  );
}
