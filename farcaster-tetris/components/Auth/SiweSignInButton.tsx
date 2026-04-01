'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSignMessage,
} from 'wagmi';
import { base } from 'wagmi/chains';
import { createSiweMessage } from 'viem/siwe';

type WalletId = 'phantom' | 'rabby' | 'metamask' | 'coinbase';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthereumProvider[];
};

type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type AnnouncedProvider = {
  info?: Partial<Eip6963ProviderInfo>;
  provider: EthereumProvider;
};

declare global {
  interface Window {
    phantom?: {
      ethereum?: EthereumProvider;
    };
  }
}

interface SiweSignInButtonProps {
  className?: string;
  onSignedIn?: (address: string) => void;
  onSignedOut?: () => void;
}

const WALLET_OPTIONS: Array<{ id: WalletId; label: string }> = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'rabby', label: 'Rabby' },
  { id: 'phantom', label: 'Phantom' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function normalizeAddress(address?: string | null) {
  return typeof address === 'string' ? address.toLowerCase() : null;
}

function shortAddress(address?: string | null) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function walletLabelById(id: WalletId) {
  return WALLET_OPTIONS.find((item) => item.id === id)?.label ?? 'Wallet';
}

function safeMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return '不明なエラーが発生しました。';
}

function isUserRejectedError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes('user rejected') ||
    text.includes('user denied') ||
    text.includes('rejected the request') ||
    text.includes('denied') ||
    text.includes('cancelled') ||
    text.includes('canceled')
  );
}

function toHexUtf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getAllCandidateProviders(
  announcedProviders: AnnouncedProvider[],
): Array<{ provider: EthereumProvider; info?: Partial<Eip6963ProviderInfo> }> {
  if (typeof window === 'undefined') return [];

  const result: Array<{ provider: EthereumProvider; info?: Partial<Eip6963ProviderInfo> }> = [];
  const seen = new Set<EthereumProvider>();

  const pushProvider = (provider?: EthereumProvider, info?: Partial<Eip6963ProviderInfo>) => {
    if (!provider || typeof provider.request !== 'function') return;
    if (seen.has(provider)) return;
    seen.add(provider);
    result.push({ provider, info });
  };

  for (const item of announcedProviders) {
    pushProvider(item.provider, item.info);
  }

  const rootEthereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (rootEthereum) {
    if (Array.isArray(rootEthereum.providers)) {
      for (const provider of rootEthereum.providers) {
        pushProvider(provider);
      }
    } else {
      pushProvider(rootEthereum);
    }
  }

  const phantomEthereum = window.phantom?.ethereum;
  if (phantomEthereum) {
    pushProvider(phantomEthereum);
  }

  return result;
}

function matchesWallet(
  walletId: WalletId,
  provider: EthereumProvider,
  info?: Partial<Eip6963ProviderInfo>,
) {
  const rdns = (info?.rdns ?? '').toLowerCase();
  const name = (info?.name ?? '').toLowerCase();

  switch (walletId) {
    case 'phantom':
      return (
        provider.isPhantom === true ||
        rdns.includes('phantom') ||
        name.includes('phantom') ||
        (typeof window !== 'undefined' && window.phantom?.ethereum === provider)
      );

    case 'rabby':
      return (
        provider.isRabby === true ||
        rdns === 'io.rabby' ||
        rdns.includes('rabby') ||
        name.includes('rabby')
      );

    case 'metamask':
      return (
        (provider.isMetaMask === true &&
          provider.isPhantom !== true &&
          provider.isRabby !== true &&
          provider.isCoinbaseWallet !== true) ||
        rdns.includes('metamask') ||
        name.includes('metamask')
      );

    case 'coinbase':
      return (
        provider.isCoinbaseWallet === true ||
        rdns.includes('coinbase') ||
        name.includes('coinbase') ||
        name === 'base'
      );

    default:
      return false;
  }
}

function detectInstalledWallets(
  announcedProviders: AnnouncedProvider[],
): Record<WalletId, EthereumProvider | null> {
  const candidates = getAllCandidateProviders(announcedProviders);

  const installed: Record<WalletId, EthereumProvider | null> = {
    phantom: null,
    rabby: null,
    metamask: null,
    coinbase: null,
  };

  for (const wallet of WALLET_OPTIONS) {
    for (const candidate of candidates) {
      if (matchesWallet(wallet.id, candidate.provider, candidate.info)) {
        installed[wallet.id] = candidate.provider;
        break;
      }
    }
  }

  return installed;
}

async function requestAccounts(provider: EthereumProvider) {
  const result = await provider.request({
    method: 'eth_requestAccounts',
  });

  if (!Array.isArray(result) || typeof result[0] !== 'string') {
    throw new Error('ウォレットアドレスを取得できませんでした。');
  }

  return result as string[];
}

async function requestChainId(provider: EthereumProvider) {
  try {
    const result = await provider.request({ method: 'eth_chainId' });
    if (typeof result === 'string') {
      return Number.parseInt(result, 16);
    }
  } catch {
    // noop
  }
  return base.id;
}

async function runAsyncMutation<TVariables, TResult>(
  hookResult: unknown,
  variables: TVariables,
): Promise<TResult> {
  const anyHook = hookResult as {
    mutateAsync?: (vars: TVariables) => Promise<TResult>;
    connectAsync?: (vars: TVariables) => Promise<TResult>;
    disconnectAsync?: (vars: TVariables) => Promise<TResult>;
    signMessageAsync?: (vars: TVariables) => Promise<TResult>;
    mutate?: (
      vars: TVariables,
      options?: {
        onSuccess?: (data: TResult) => void;
        onError?: (error: unknown) => void;
      },
    ) => void;
    connect?: (
      vars: TVariables,
      options?: {
        onSuccess?: (data: TResult) => void;
        onError?: (error: unknown) => void;
      },
    ) => void;
    disconnect?: (
      vars: TVariables,
      options?: {
        onSuccess?: (data: TResult) => void;
        onError?: (error: unknown) => void;
      },
    ) => void;
    signMessage?: (
      vars: TVariables,
      options?: {
        onSuccess?: (data: TResult) => void;
        onError?: (error: unknown) => void;
      },
    ) => void;
  };

  if (typeof anyHook.mutateAsync === 'function') return anyHook.mutateAsync(variables);
  if (typeof anyHook.connectAsync === 'function') return anyHook.connectAsync(variables);
  if (typeof anyHook.disconnectAsync === 'function') return anyHook.disconnectAsync(variables);
  if (typeof anyHook.signMessageAsync === 'function') return anyHook.signMessageAsync(variables);

  const candidate =
    anyHook.mutate ?? anyHook.connect ?? anyHook.disconnect ?? anyHook.signMessage;

  if (typeof candidate === 'function') {
    return new Promise<TResult>((resolve, reject) => {
      candidate(variables, {
        onSuccess: (data) => resolve(data),
        onError: (error) => reject(error),
      });
    });
  }

  throw new Error('wagmi の mutation 関数が見つかりませんでした。');
}

export default function SiweSignInButton({
  className = '',
  onSignedIn,
  onSignedOut,
}: SiweSignInButtonProps) {
  const { address: wagmiAddress, chainId: wagmiChainId } = useAccount();
  const connect = useConnect();
  const connectors = useConnectors();
  const disconnect = useDisconnect();
  const signMessage = useSignMessage();

  const [announcedProviders, setAnnouncedProviders] = useState<AnnouncedProvider[]>([]);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<WalletId | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [busyWalletId, setBusyWalletId] = useState<WalletId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const installedWallets = useMemo(
    () => detectInstalledWallets(announcedProviders),
    [announcedProviders],
  );

  const coinbaseConnector = useMemo(() => {
    return connectors.find((connector) =>
      connector.name.toLowerCase().includes('coinbase'),
    );
  }, [connectors]);

  const displayAddress =
    sessionAddress ?? connectedAddress ?? normalizeAddress(wagmiAddress) ?? null;

  const isAuthenticated = !!sessionAddress;
  const activeWalletLabel = selectedWalletId ? walletLabelById(selectedWalletId) : '接続中';

  const connectPending =
    Boolean((connect as { isPending?: boolean }).isPending) ||
    Boolean((connect as { status?: string }).status === 'pending');

  const disconnectPending =
    Boolean((disconnect as { isPending?: boolean }).isPending) ||
    Boolean((disconnect as { status?: string }).status === 'pending');

  const signPending =
    Boolean((signMessage as { isPending?: boolean }).isPending) ||
    Boolean((signMessage as { status?: string }).status === 'pending');

  const anyBusy = connectPending || signPending || authenticating || !!busyWalletId;

  const fetchSession = useCallback(async () => {
    try {
      setCheckingSession(true);
      const response = await fetch('/api/siwe/me', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = await response.json();

      if (data?.authenticated && typeof data?.address === 'string') {
        setSessionAddress(data.address.toLowerCase());
      } else {
        setSessionAddress(null);
      }
    } catch {
      setSessionAddress(null);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedWalletId = window.sessionStorage.getItem('fartetris_wallet_id') as WalletId | null;
    const savedAddress = window.sessionStorage.getItem('fartetris_wallet_address');

    if (savedWalletId && WALLET_OPTIONS.some((item) => item.id === savedWalletId)) {
      setSelectedWalletId(savedWalletId);
    }

    if (savedAddress) {
      setConnectedAddress(savedAddress.toLowerCase());
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAnnounceProvider = (event: Event) => {
      const detail = (event as Event & {
        detail?: { info?: Partial<Eip6963ProviderInfo>; provider?: EthereumProvider };
      }).detail;

      const provider = detail?.provider;
      if (!provider) return;

      const info = detail?.info;

      setAnnouncedProviders((prev) => {
        const exists = prev.some((item) => item.provider === provider);
        if (exists) return prev;
        return [...prev, { provider, info }];
      });
    };

    const requestProviders = () => {
      window.dispatchEvent(new Event('eip6963:requestProvider'));
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounceProvider as EventListener);
    window.addEventListener('ethereum#initialized', requestProviders as EventListener);

    requestProviders();

    const t1 = window.setTimeout(requestProviders, 100);
    const t2 = window.setTimeout(requestProviders, 800);

    return () => {
      window.removeEventListener(
        'eip6963:announceProvider',
        handleAnnounceProvider as EventListener,
      );
      window.removeEventListener('ethereum#initialized', requestProviders as EventListener);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const persistWalletState = useCallback((walletId: WalletId, address: string) => {
    const normalized = address.toLowerCase();
    setSelectedWalletId(walletId);
    setConnectedAddress(normalized);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('fartetris_wallet_id', walletId);
      window.sessionStorage.setItem('fartetris_wallet_address', normalized);
    }
  }, []);

  const clearWalletState = useCallback(() => {
    setSelectedWalletId(null);
    setConnectedAddress(null);
    setSessionAddress(null);

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('fartetris_wallet_id');
      window.sessionStorage.removeItem('fartetris_wallet_address');
    }
  }, []);

  const logoutSiweSession = useCallback(async () => {
    try {
      await fetch('/api/siwe/logout', {
        method: 'POST',
      });
    } catch {
      // noop
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    setWalletModalOpen(false);

    try {
      await logoutSiweSession();
    } catch {
      // noop
    }

    try {
      await runAsyncMutation<Record<string, never>, void>(disconnect, {});
    } catch {
      // noop
    }

    clearWalletState();
    setError(null);
    onSignedOut?.();
  }, [clearWalletState, disconnect, logoutSiweSession, onSignedOut]);

  const verifySiwe = useCallback(
    async (message: string, signature: string) => {
      const verifyResponse = await fetch('/api/siwe/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          signature,
        }),
      });

      const verifyData = await verifyResponse.json().catch(() => null);

      if (!verifyResponse.ok || !verifyData?.ok) {
        throw new Error(
          typeof verifyData?.error === 'string'
            ? verifyData.error
            : 'SIWE 検証に失敗しました。',
        );
      }

      const verifiedAddress =
        typeof verifyData?.address === 'string'
          ? verifyData.address.toLowerCase()
          : null;

      if (!verifiedAddress) {
        throw new Error('署名済みアドレスの取得に失敗しました。');
      }

      setSessionAddress(verifiedAddress);
      setWalletModalOpen(false);
      onSignedIn?.(verifiedAddress);
    },
    [onSignedIn],
  );

  const createSiwePayload = useCallback(async (walletAddress: string, chainId: number) => {
    const nonceResponse = await fetch('/api/siwe/nonce', {
      method: 'GET',
      cache: 'no-store',
    });

    const nonceData = await nonceResponse.json();

    if (!nonceData?.nonce || typeof nonceData.nonce !== 'string') {
      throw new Error('nonce の取得に失敗しました。');
    }

    return createSiweMessage({
      domain: window.location.host,
      address: walletAddress as `0x${string}`,
      statement: 'Sign in to FARTETRIS',
      uri: window.location.origin,
      version: '1',
      chainId,
      nonce: nonceData.nonce,
    });
  }, []);

  const signInWithInjectedProvider = useCallback(
    async (provider: EthereumProvider, walletAddress: string, chainId: number) => {
      const message = await createSiwePayload(walletAddress, chainId);
      const signature = await provider.request({
        method: 'personal_sign',
        params: [toHexUtf8(message), walletAddress],
      });

      if (typeof signature !== 'string') {
        throw new Error('署名に失敗しました。');
      }

      await verifySiwe(message, signature);
    },
    [createSiwePayload, verifySiwe],
  );

  const signInWithCoinbase = useCallback(
    async (walletAddress: string, chainId: number) => {
      const message = await createSiwePayload(walletAddress, chainId);
      const signature = await runAsyncMutation<{ message: string }, string>(signMessage, {
        message,
      });
      await verifySiwe(message, signature);
    },
    [createSiwePayload, signMessage, verifySiwe],
  );

  const handleInjectedWalletConnect = useCallback(
    async (walletId: WalletId) => {
      const provider = installedWallets[walletId];
      const walletLabel = walletLabelById(walletId);

      if (!provider) {
        if (walletId === 'metamask') {
          setError('MetaMask がインストールされていません。');
        } else {
          setError(`${walletLabel} がインストールされていません。`);
        }
        return;
      }

      try {
        setBusyWalletId(walletId);
        setError(null);
        setAuthenticating(true);

        const accounts = await requestAccounts(provider);
        const walletAddress = accounts[0];
        const chainId = await requestChainId(provider);

        persistWalletState(walletId, walletAddress);
        await signInWithInjectedProvider(provider, walletAddress, chainId);
      } catch (err) {
        const message = safeMessage(err);

        if (isUserRejectedError(message)) {
          setError('接続または署名がキャンセルされました。');
        } else {
          setError(message);
        }

        await logoutSiweSession();
        clearWalletState();
      } finally {
        setBusyWalletId(null);
        setAuthenticating(false);
      }
    },
    [
      clearWalletState,
      installedWallets,
      logoutSiweSession,
      persistWalletState,
      signInWithInjectedProvider,
    ],
  );

  const handleCoinbaseConnect = useCallback(async () => {
    if (!coinbaseConnector) {
      setError('Coinbase Wallet connector を取得できませんでした。');
      return;
    }

    try {
      setBusyWalletId('coinbase');
      setError(null);
      setAuthenticating(true);

      const result = await runAsyncMutation<
        { connector: unknown },
        { accounts?: readonly string[]; chainId?: number }
      >(connect, { connector: coinbaseConnector });

      const walletAddress =
        Array.isArray(result?.accounts) && typeof result.accounts[0] === 'string'
          ? result.accounts[0]
          : null;

      const chainId = result?.chainId ?? wagmiChainId ?? base.id;

      if (!walletAddress) {
        throw new Error('Coinbase Wallet のアドレス取得に失敗しました。');
      }

      persistWalletState('coinbase', walletAddress);
      await signInWithCoinbase(walletAddress, chainId);
    } catch (err) {
      const message = safeMessage(err);

      if (isUserRejectedError(message)) {
        setError('Coinbase Wallet の接続または署名がキャンセルされました。');
      } else {
        setError(`Coinbase Wallet 接続エラー: ${message}`);
      }

      await logoutSiweSession();
      clearWalletState();
    } finally {
      setBusyWalletId(null);
      setAuthenticating(false);
    }
  }, [
    clearWalletState,
    coinbaseConnector,
    connect,
    logoutSiweSession,
    persistWalletState,
    signInWithCoinbase,
    wagmiChainId,
  ]);

  const renderErrorBox = () => {
    if (!error) return null;

    return (
      <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3">
        <div className="mb-2 text-xs font-bold text-red-200">エラー</div>
        <pre className="select-text whitespace-pre-wrap break-all text-left text-xs leading-relaxed text-red-100">
          {error}
        </pre>
      </div>
    );
  };

  return (
    <div className={cx('w-full', className)}>
      {!isAuthenticated ? (
        <>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setWalletModalOpen(true);
            }}
            disabled={anyBusy}
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-center text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] hover:from-orange-400 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {anyBusy ? '接続中...' : 'ウォレット'}
          </button>

          {renderErrorBox()}

          {walletModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4">
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#6c3e9a] p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-white">ウォレットを接続</h3>
                  <button
                    type="button"
                    onClick={() => setWalletModalOpen(false)}
                    className="rounded-full px-3 py-1 text-sm font-bold text-purple-100 transition hover:bg-white/10 hover:text-white"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => void handleInjectedWalletConnect('metamask')}
                    disabled={anyBusy}
                    className={cx(
                      'w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:from-orange-400 hover:to-amber-300',
                      anyBusy && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {busyWalletId === 'metamask' ? '接続中...' : 'MetaMask'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleInjectedWalletConnect('rabby')}
                    disabled={anyBusy}
                    className={cx(
                      'w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:from-orange-400 hover:to-amber-300',
                      anyBusy && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {busyWalletId === 'rabby' ? '接続中...' : 'Rabby'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleInjectedWalletConnect('phantom')}
                    disabled={anyBusy}
                    className={cx(
                      'w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:from-orange-400 hover:to-amber-300',
                      anyBusy && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {busyWalletId === 'phantom' ? '接続中...' : 'Phantom'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCoinbaseConnect()}
                    disabled={anyBusy}
                    className={cx(
                      'w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4 text-center text-sm font-bold text-white shadow-lg transition hover:from-orange-400 hover:to-amber-300',
                      anyBusy && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {busyWalletId === 'coinbase' ? '接続中...' : 'Coinbase Wallet'}
                  </button>
                </div>

                {renderErrorBox()}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-orange-300/20 bg-black/20 p-3 shadow-lg">
          <div className="mb-1 text-center text-xs font-semibold tracking-wide text-orange-100">
            {activeWalletLabel}
          </div>

          <div className="mb-3 text-center text-sm font-bold text-white">
            {shortAddress(displayAddress)}
          </div>

          <button
            type="button"
            onClick={() => void disconnectWallet()}
            disabled={disconnectPending}
            className="w-full rounded-full bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3 text-sm font-bold text-white transition hover:from-slate-500 hover:to-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {disconnectPending ? '切断中...' : 'ウォレットを切断'}
          </button>

          {renderErrorBox()}
        </div>
      )}

      {checkingSession && (
        <div className="mt-2 text-center text-[11px] text-purple-200/80">
          読み込み中...
        </div>
      )}
    </div>
  );
}
