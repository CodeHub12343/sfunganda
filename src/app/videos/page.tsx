import type { Metadata } from "next";
import { api } from "@/lib/api";
import { VideosFeed } from "./VideosFeed";

export const metadata: Metadata = {
  title: "Videos — Sarah's Foundation",
  description: "Field reports and stories from Sarah's Foundation.",
};

export const revalidate = 60;

type VideoRow = {
  id: string;
  title: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  hls_url: string | null;
  created_at: string;
};

export default async function VideosPage() {
  let videos: VideoRow[] = [];
  try {
    videos = await api<VideoRow[]>("/videos");
  } catch {
    videos = [];
  }
  return <VideosFeed videos={videos} />;
}
