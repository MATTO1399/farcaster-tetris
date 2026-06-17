'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';

const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    // injected() — Rabby/MetaMaskなど通常のブラウザ拡張を認識
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'FARTETRIS' }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  // ★修正: マルチプロバイダー検出をOFF
  // （window.ethereum の再定義による Cannot redefine エラーを回避）
  multiInjectedProviderDiscovery: true,
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
