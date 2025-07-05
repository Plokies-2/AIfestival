// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // lightweight-charts 번들 포함
  transpilePackages: ['lightweight-charts'],

  /* ───── dev overlay 설정 ─────
     appIsrStatus = false  → 정적/동적 경로 번개 아이콘 숨김
     buildActivity  = false → “building…” 좌측 상단 토스트도 숨김
  */
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
};

export default nextConfig;