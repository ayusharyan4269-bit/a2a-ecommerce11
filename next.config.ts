import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "algosdk",
    "@x402-avm/core",
    "@x402-avm/avm",
    "@x402-avm/fetch",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "@web3auth/modal": false,
        "@web3auth/single-factor-auth": false,
        "@web3auth/base": false,
        "@web3auth/base-provider": false,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      { source: "/sell", destination: "/" },
      { source: "/vault", destination: "/" },
      { source: "/marketplace", destination: "/" },
      { source: "/looker", destination: "/" },
    ];
  },
};

export default nextConfig;
