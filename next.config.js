const path = require('path');

module.exports = {
  /** Short alias → same handler as dev-whatsapp-template (POST body preserved with 307). */
  async redirects() {
    return [
      {
        source: '/api/greenapi/dev-send-event-invite',
        destination: '/api/greenapi/dev-whatsapp-template',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      // beforeFiles = רץ לפני קבצים סטטיים. ברירת מחדל (מערך) = afterFiles = רץ אחרי,
      // ולכן הקובץ הסטטי נשלח קודם עם octet-stream ומופעיל הורדה.
      beforeFiles: [
        {
          source: '/.well-known/apple-developer-merchantid-domain-association',
          destination: '/api/apple-pay-file',
        },
      ],
    };
  },
  env: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Turbopack configuration (Next.js 16+)
  turbopack: {},
  webpack: (config) => {
    // Ensure only one copy of React is bundled to avoid invalid hook errors
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js'),
    };
    return config;
  },
};