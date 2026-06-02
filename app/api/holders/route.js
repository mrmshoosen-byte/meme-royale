import { NextResponse } from 'next/server';

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

async function fetchFromEndpoint(rpcEndpoint, mint) {
  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  return json.result.value;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) {
    return NextResponse.json({ error: 'Missing mint parameter' }, { status: 400 });
  }

  let lastError;

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const accounts = await fetchFromEndpoint(endpoint, mint);

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

      const wallets = [];

      for (const account of accounts) {
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

      return NextResponse.json({ wallets });
    } catch (err) {
      lastError = err;
      console.warn(`RPC endpoint failed: ${endpoint}`, err.message);
    }
  }

  return NextResponse.json(
    { error: lastError?.message || 'All RPC endpoints failed' },
    { status: 500 }
  );
}
