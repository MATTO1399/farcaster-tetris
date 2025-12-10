# Tetris - Farcaster Mini App

Classic Tetris game as a Farcaster Mini App with NFT rewards.

## 🎮 Features

- **Classic Tetris Gameplay**: All standard Tetris mechanics
- **Mobile-Friendly**: Touch controls with swipe gestures
- **Responsive Design**: Works on desktop and mobile
- **Score & Level System**: Progressive difficulty
- **NFT Rewards**: Mint NFT for high scores (optional)
- **Farcaster Integration**: Native mini app experience

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Farcaster account
- Coinbase Developer account (for API key)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd farcaster-tetris

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your keys
```

### Environment Variables

Create `.env.local` file:

```env
NEXT_PUBLIC_CDP_API_KEY=your_coinbase_api_key
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x... # Optional
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
FARCASTER_WEBHOOK_SECRET=your_secret
```

### Development

```bash
# Start development server
pnpm dev

# Open http://localhost:3000
```

### Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## 📦 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### Manual Deployment

```bash
pnpm build
# Deploy the .next folder to your hosting service
```

## 🔧 Farcaster Configuration

### 1. Account Association

Generate your account association data:

```bash
# Use Farcaster CLI or SDK to generate
# accountAssociation header, payload, signature
```

Update `app/.well-known/farcaster.json/route.ts` with your data.

### 2. Register Mini App

1. Go to Warpcast
2. Open Developer Tools
3. Enable Developer Mode
4. Register your app URL
5. Test using Farcaster Mini App validator

### 3. Webhook Setup

Your webhook endpoint: `https://your-app.vercel.app/api/webhook`

Events handled:
- `frame.added` - User adds app
- `frame.removed` - User removes app
- `notifications.enabled` - User enables notifications
- `notifications.disabled` - User disables notifications

## 🎨 Customization

### Game Settings

Edit `utils/constants.ts`:

```typescript
export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const INITIAL_SPEED = 1000;
export const NFT_THRESHOLD_SCORE = 1000;
```

### Styling

- Main styles: `app/globals.css`
- Tailwind config: `tailwind.config.ts`
- Game colors: Modify `TETROMINOS` in `utils/constants.ts`

### NFT Integration (Optional)

1. Deploy NFT contract on Base Sepolia
2. Add contract address to `.env.local`
3. Implement minting logic in `app/page.tsx`

## 🕹️ Controls

### Keyboard
- **← →**: Move left/right
- **↑ / Space**: Rotate
- **↓**: Soft drop
- **Enter**: Hard drop
- **P**: Pause

### Touch (Mobile)
- **Swipe Left/Right**: Move
- **Swipe Up**: Rotate
- **Swipe Down**: Hard drop
- **Tap**: Rotate

## 📁 Project Structure

```
farcaster-tetris/
├── app/
│   ├── .well-known/
│   │   └── farcaster.json/
│   │       └── route.ts          # Farcaster manifest
│   ├── api/
│   │   ├── webhook/
│   │   │   └── route.ts          # Webhook handler
│   │   └── notify/
│   │       └── route.ts          # Notification API
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   └── Game/
│       └── TetrisGame.tsx        # Main game component
├── utils/
│   ├── constants.ts              # Game constants
│   └── tetrisLogic.ts            # Core game logic
├── public/
│   ├── icon.png                  # App icon
│   └── splash.png                # Splash screen
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## 🐛 Troubleshooting

### Game not loading
- Check browser console for errors
- Verify all dependencies installed
- Try clearing Next.js cache: `rm -rf .next`

### Farcaster integration issues
- Verify `.well-known/farcaster.json` is accessible
- Check account association credentials
- Test with Farcaster validator tool

### Deployment issues
- Ensure all environment variables are set
- Check Vercel build logs
- Verify Node.js version compatibility

## 📝 License

MIT License - feel free to use for your own projects!

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📚 Resources

- [Farcaster Docs](https://docs.farcaster.xyz/)
- [Next.js Docs](https://nextjs.org/docs)
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
- [Base Network](https://base.org/)

## 🎯 Roadmap

- [ ] Multiplayer mode
- [ ] Leaderboard integration
- [ ] Custom themes
- [ ] Power-ups
- [ ] Achievement system
- [ ] Social sharing

---

Built with ❤️ for the Farcaster community
