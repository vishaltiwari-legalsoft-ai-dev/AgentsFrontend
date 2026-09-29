/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The floating dev-tools badge sits top-right where the stats bar's
  // notification bell lives — hide it so it can't swallow clicks in dev.
  devIndicators: false,
  env: {
    // UI-lab default: skip the Google sign-in and open the shell as a mock
    // user (see lib/auth.tsx). This repo exists only to prototype the UI
    // revamp, so every deployment should show the UI itself, not a login
    // wall. Set to "0" to get the real sign-in flow back; the live repo
    // does not carry this default, so the flag is off there.
    NEXT_PUBLIC_PREVIEW_NO_AUTH: process.env.NEXT_PUBLIC_PREVIEW_NO_AUTH ?? "1",
  },
};

export default nextConfig;
