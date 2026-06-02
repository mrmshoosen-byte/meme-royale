import { NextResponse } from 'next/server';

const RPC_ENDPOINT =
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

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

async function rpcCall(method, params) {
  const res = await fetch(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.result;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) {
    return NextResponse.json({ error: 'Missing mint parameter' }, { status: 400 });
  }

  try {
    const result = await rpcCall('getProgramAccounts', [
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
    ]);

    const holderMap = new Map();

    for (const account of result) {
      const info = account.account.data.parsed.info;

      const owner = info.owner;
      const amount = Number(info.tokenAmount.uiAmount || 0);

      if (!owner || amount <= 0) continue;

      holderMap.set(owner, (holderMap.get(owner) || 0) + amount);
    }

    const wallets = [...holderMap.entries()]
      .map(([wallet, tokenAmount]) => {
        const entries = getEntries(tokenAmount);

        return {
          id: wallet,
          wallet,
          tokenAmount,
          entries,
          status: 'alive',
        };
      })
      .filter((holder) => holder.entries > 0)
      .sort((a, b) => b.tokenAmount - a.tokenAmount);

    return NextResponse.json({
      wallets,
      totalHolders: wallets.length,
    });
  } catch (err) {
    console.error('Holder fetch failed:', err);

    return NextResponse.json(
      {
        error: 'Failed to fetch holders',
        details: err.message,
      },
      { status: 500 }
    );
  }
}
