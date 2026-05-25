/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },     // Google avatars
      { protocol: 'https', hostname: 'profile.line-scdn.net' },          // LINE avatars
      { protocol: 'https', hostname: '*.supabase.co' },                  // Supabase storage
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
}

export default nextConfig
