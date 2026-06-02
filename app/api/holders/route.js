import { NextResponse } from 'next/server';

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

const ENTRY_TIERS = [
  { minTokens: 500_000, entries: 3 },
  { minTokens: 100_000, entries: 2 },
  { minTokens: 10_000, entries: 1 },
];

const getEntries = (tokenAmount) => {
  for (const tier of ENTRY_TIERS) {
    if (tokenAmount >= tier.minTokens) return tier.entries;
  }
  return 0;
};

async function fetchFromEndpoint(rpcEndpoint, mint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [mint],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${rpcEndpoint}`);
    }

    const json = await response.json();

    if (json?.error) {
      throw new Error(json.error.message || `RPC error from ${rpcEndpoint}`);
    }

    if (!json.result?.value) {
      throw new Error(`No result from ${rpcEndpoint}`);
    }

    const wallets = [];

    for (const account of json.result.value) {
      const tokenAmount = account.uiAmount || 0;
      const address = account.address;
      if (!address || tokenAmount === 0) continue;

      const entries = getEntries(tokenAmount);
      if (entries === 0) continue;

      wallets.push({
        id: address,
        wallet: address,
        tokenAmount,
        entries,
        status: 'alive',
      });
    }

    return wallets;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) {
    return NextResponse.json({ error: 'Missing mint parameter' }, { status: 400 });
  }

  try {
    // Race all endpoints in parallel — fastest one wins
    const wallets = await Promise.any(
      RPC_ENDPOINTS.map((endpoint) => fetchFromEndpoint(endpoint, mint))
    );

    return NextResponse.json({ wallets });
  } catch (err) {
    console.error('All RPC endpoints failed', err);
    return NextResponse.json(
      { error: 'All RPC endpoints failed. Please try again.' },
      { status: 500 }
    );
  }
}
