const ROOT_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://farcaster-tetris.vercel.app';

export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE4OTk0LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4M2RjNzgxQzg1NzExNGJDNjgzRTJCMzY2M2JDOTA0OGU1YkE3ODE3MSJ9",
    payload: "eyJkb21haW4iOiJmYXJjYXN0ZXItdGV0cmlzLnZlcmNlbC5hcHAifQ",
    signature: "cfCmm1OsTTL5apfOjSRPHNXeVKBXhijtg6RfGBS8tVIgTpjmbzQxf10IBpQrWKc4KA9/t3fvZuh3VyHj33MAZxs="
  },
  miniapp: {
    version: "1",
    name: "FARTETRIS",
    subtitle: "Classic Tetris on Farcaster",
    description: "Play the classic Tetris game on Farcaster with special ojama blocks",
    screenshotUrls: [],
    iconUrl: `${ROOT_URL}/icon.png`,
    splashImageUrl: `${ROOT_URL}/splash.png`,
    splashBackgroundColor: "#1e1b4b",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["tetris", "game", "arcade"],
    heroImageUrl: `${ROOT_URL}/splash.png`,
    tagline: "Classic Tetris with a twist",
    ogTitle: "FARTETRIS",
    ogDescription: "Play FARTETRIS on Farcaster",
    ogImageUrl: `${ROOT_URL}/icon.png`,
  },
} as const;