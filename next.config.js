/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable for development to prevent double SSE connections

  // Vercel 배포 최적화
  experimental: {
    // serverComponentsExternalPackages는 더 이상 사용되지 않음 (serverExternalPackages로 이동됨)
  },

  webpack: (config, { isServer }) => {
    // Handle node modules that need to be external
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        crypto: false,
      };
    }

    // Python 스크립트 파일을 빌드에서 제외
    config.module.rules.push({
      test: /\.py$/,
      use: 'ignore-loader',
    });

    return config;
  },

  // 환경변수 검증 비활성화 (빌드 시)
  env: {
    SKIP_ENV_VALIDATION: 'true',
  },
};

module.exports = nextConfig;
