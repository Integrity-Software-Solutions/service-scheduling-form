/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  assetPrefix: '/warranty/service-scheduling-form',
  basePath: '/warranty/service-scheduling-form',
  // Helps Apache/nginx serve index.html for directory URLs on PHP-FPM hosts.
  trailingSlash: true,
  // Uncomment if the app is served from a subdirectory, e.g. /service-scheduling/
  // basePath: '/service-scheduling',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['192.168.2.125'],
}

export default nextConfig
