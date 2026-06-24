/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Flow is client-only (loaded via dynamic import ssr:false).
  // Do NOT add webpack externals here — it breaks dev chunk resolution (948.js errors).
  experimental: {
    serverComponentsExternalPackages: ["reactflow", "@reactflow/core"],
  },
};

export default nextConfig;
