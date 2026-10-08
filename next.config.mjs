/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The floating dev-tools badge sits top-right where the stats bar's
  // notification bell lives — hide it so it can't swallow clicks in dev.
  devIndicators: false,
  // Preview/demo mode (mock all-roles user, canned GET fixtures from
  // lib/demo.ts) is OFF unless the build explicitly sets
  // NEXT_PUBLIC_PREVIEW_NO_AUTH=1. This repo is now the live console, so
  // no deployment may boot into fixtures by omission — a visitor must see
  // the real sign-in and the real backend. Set the variable to "1" only on
  // a throwaway UI-lab preview; lib/api.timeout.test.ts pins this default.
};

export default nextConfig;
