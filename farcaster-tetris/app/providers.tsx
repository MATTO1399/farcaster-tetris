'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors'; // ★injectedを追加

const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(), // ★Rabbyなどの拡張機能を最優先で認識させる
    coinbaseWallet({ appName: 'FARTETRIS' }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  // インジェクトされたプロバイダー（Rabby等）を自動で見つける設定を有効化
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
