import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Providers } from "@/lib/providers";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const SITE = {
  name: "Sarah's Foundation",
  tagline: "Providing Hope · Creating Home · Creating Lives",
  description:
    "Sarah's Foundation connects compassionate people with life-changing initiatives that provide shelter, education, care, and opportunity to vulnerable children and families.",
  url: "https://www.sfuganda.com",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Providing Hope, Creating Home, Creating Lives`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "charity",
    "nonprofit",
    "orphanage support",
    "sponsor a child",
    "humanitarian",
    "donate",
    "Africa",
  ],
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#103D7A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
