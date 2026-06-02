import { NextResponse } from 'next/server';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_DECIMALS = 6;

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
      method: 'getProgramAccounts',
      params: [
        TOKEN_PROGRAM_ID,
        {
          encoding: 'jsonParsed',
          filters: [
            { dataSize: 165 },
            {
              memcmp: {
                offset: 0,
                bytes: mint,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${rpcEndpoint}`);
  }

  const json = await response.json();

  if (json?.error) {
    throw new Error(json.error.message || `RPC error from ${rpcEndpoint}`);
  }

  if (!json.result) {
    throw new Error(`No result from ${rpcEndpoint}`);
  }

  return json.result;
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
        { minTokens: 1_000_000, entries: 3 },
        { minTokens: 500_000, entries: 2 },
        { minTokens: 100_000, entries: 1 },
      ];

      const getEntries = (tokenAmount) => {
        for (const tier of ENTRY_TIERS) {
          if (tokenAmount >= tier.minTokens) return tier.entries;
        }
        return 0;
      };

      const wallets = [];

      for (const account of accounts) {
        const info = account?.account?.data?.parsed?.info;
        if (!info) continue;

        const owner = info.owner;
        const rawAmount = info.tokenAmount?.amount;
        if (!owner || !rawAmount) continue;

        const tokenAmount = Number(rawAmount) / Math.pow(10, TOKEN_DECIMALS);
        const entries = getEntries(tokenAmount);

        if (entries === 0) continue;

        wallets.push({
          id: owner,
          wallet: owner,
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
