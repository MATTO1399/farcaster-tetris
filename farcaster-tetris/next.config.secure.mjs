/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Webpack設定
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },

  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // XSS保護
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // クリックジャッキング対策
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS保護（古いブラウザ用）
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrerポリシー
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // 権限ポリシー
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // APIエンドポイント用のCORS設定
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Farcaster-Signature',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24時間
          },
        ],
      },
    ];
  },

  // 環境変数の検証
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // 画像最適化設定
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
  },

  // 本番環境の最適化
  productionBrowserSourceMaps: false, // ソースマップを無効化（セキュリティ）
  poweredByHeader: false, // X-Powered-Byヘッダーを削除
  compress: true, // gzip圧縮を有効化
};

export default nextConfig;
