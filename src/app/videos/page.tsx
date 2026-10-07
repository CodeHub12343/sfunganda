import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { VideosFeed, type VideoRow } from "./VideosFeed";

export const metadata: Metadata = {
  title: "Videos — Sarah's Foundation",
  description:
    "Field reports and stories from Sarah's Foundation — short films from the people doing the work, reviewed and released in line with our safeguarding policy.",
};

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  let videos: VideoRow[] = [];
  try {
    videos = await api<VideoRow[]>("/videos");
  } catch {
    videos = [];
  }
  return (
    <>
      <Navbar />
      <main>
        <VideosFeed videos={videos} />
      </main>
      <Footer />
    </>
  );
}
