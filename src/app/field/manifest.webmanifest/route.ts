import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      name: "Sarah's Foundation — Field",
      short_name: "SF Field",
      start_url: "/field",
      scope: "/field",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#f59e0b",
      icons: [
        { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      ],
    },
    { headers: { "cache-control": "public, max-age=3600" } }
  );
}
