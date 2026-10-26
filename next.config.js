/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serve the static marketing homepage (public/index.html) at the root.
  // Other static pages (e.g. /ai-course.html) are served directly from public/.
  // The admin panel lives under /admin.
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      // Italy Newcomers Flutter web app (static build in public/italy, base href /italy/).
      { source: "/italy", destination: "/italy/index.html" },
    ];
  },
};

module.exports = nextConfig;
