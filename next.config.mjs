/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    // Enable styled-components SWC transform (SSR, displayName, minification)
    styledComponents: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
