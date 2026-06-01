'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const PREVIOUS_WINNERS = [
  { season: 4, winner: '3mNx...7Yw2', jackpot: '14,000 $MRYL' },
  { season: 3, winner: 'Kp8Z...1Qa4', jackpot: '19,000 $MRYL' },
  { season: 2, winner: '9fBv...6Rt3', jackpot: '22,000 $MRYL' },
  { season: 1, winner: '2sLd...8Xm5', jackpot: '17,000 $MRYL' },
  { season: 0, winner: '7wCj...4Hk9', jackpot: '25,000 $MRYL' },
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getLivesFromHoldings = (holdings) => {
  if (holdings >= 50000) return 3;
  if (holdings >= 25000) return 2;
  if (holdings >= 10000) return 1;
  return 0;
};

const generateAddress = () =>
  Array.from({ length: 44 }, () => BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)]).join('');

const shortenWallet = (wallet) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

const generateWallets = () => {
  const wallets = Array.from({ length: 20 }, (_, index) => {
    const holdings = randomInt(10000, 120000);
    const lives = getLivesFromHoldings(holdings);
    return {
      id: index + 1,
      wallet: generateAddress(),
      holdings,
      lives,
      status: lives > 0 ? 'alive' : 'eliminated',
      rank: 0,
    };
  });

  const ranked = [...wallets].sort((a, b) => b.holdings - a.holdings);
  const rankMap = new Map(ranked.map((wallet, idx) => [wallet.id, idx + 1]));

  return wallets.map((wallet) => ({ ...wallet, rank: rankMap.get(wallet.id) ?? 0 }));
};

const formatCountdown = (totalSeconds) => {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const generateInitialCountdown = () => {
  const minutes = randomInt(0, 59);
  const seconds = randomInt(0, 59);
  return minutes * 60 + seconds;
};

export default function Home() {
  const [wallets, setWallets] = useState(() => generateWallets());
  const [eliminationMessage, setEliminationMessage] = useState(null);
  const [season, setSeason] = useState(1);
  const [countdown, setCountdown] = useState('00:00:00');
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const countdownRef = useRef(generateInitialCountdown());

  const survivors = useMemo(() => wallets.filter((wallet) => wallet.status === 'alive').length, [wallets]);
  const winner = useMemo(() => wallets.find((wallet) => wallet.status === 'alive') ?? null, [wallets]);

  useEffect(() => {
    setCountdown(formatCountdown(countdownRef.current));
    const timer = setInterval(() => {
      countdownRef.current = countdownRef.current <= 0 ? 59 * 60 + 59 : countdownRef.current - 1;
      setCountdown(formatCountdown(countdownRef.current));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const runEligibilityCheck = () => {
    const query = checkInput.trim().toLowerCase();
    const match = wallets.find((wallet) => wallet.wallet.toLowerCase().includes(query) && query.length > 0);

    if (match) {
      setCheckResult({
        eligible: true,
        balance: match.holdings,
        lives: match.lives,
        arenaStatus: match.status === 'alive' ? 'In Arena' : 'Eliminated',
      });
      return;
    }

    setCheckResult({
      eligible: false,
      balance: 3000,
      lives: 0,
      arenaStatus: 'Not Entered',
    });
  };

  const simulateElimination = () => {
    if (gameOver) return;

    const aliveWallets = wallets.filter((wallet) => wallet.status === 'alive');
    if (aliveWallets.length <= 1) {
      setGameOver(true);
      return;
    }

    const selected = aliveWallets[Math.floor(Math.random() * aliveWallets.length)];

    const updatedWallets = wallets.map((wallet) => {
      if (wallet.id !== selected.id) return wallet;

      if (wallet.lives > 1) {
        return { ...wallet, lives: wallet.lives - 1 };
      }

      return { ...wallet, lives: 0, status: 'eliminated' };
    });

    const updatedSelected = updatedWallets.find((wallet) => wallet.id === selected.id);

    if (selected.lives > 1) {
      setEliminationMessage(
        `⚠️ Wallet ${shortenWallet(selected.wallet)} lost a life! ${updatedSelected?.lives ?? 0} lives left.`
      );
    } else {
      setEliminationMessage(`💀 Wallet ${shortenWallet(selected.wallet)} has been eliminated from the arena.`);
    }

    const aliveAfter = updatedWallets.filter((wallet) => wallet.status === 'alive').length;
    if (aliveAfter <= 1) {
      setGameOver(true);
    }

    setWallets(updatedWallets);
  };

  const startNewSeason = () => {
    setWallets(generateWallets());
    setSeason((current) => current + 1);
    setGameOver(false);
    setEliminationMessage(null);
    setCheckInput('');
    setCheckResult(null);
    countdownRef.current = generateInitialCountdown();
    setCountdown(formatCountdown(countdownRef.current));
  };

  return (
    <main>
      <section className="hero">
        <div className="hero-badge">🏆 SEASON {season} · LIVE</div>
        <h1 className="hero-title">MEME ROYALE</h1>
        <p className="hero-tagline">Buy. Hold. Survive. Win.</p>
        <p className="hero-desc">
          Holders above the minimum enter the arena. Every hour, one wallet is eliminated. Last wallet standing wins
          the jackpot.
        </p>
        <div className="hero-pills">
          <span>&quot;Every holder enters the arena.&quot;</span>
          <span>&quot;One wallet falls every hour.&quot;</span>
          <span>&quot;Final wallet wins the jackpot.&quot;</span>
          <span>&quot;Survive until the end.&quot;</span>
          <span>&quot;The longer you hold, the longer you stay in the game.&quot;</span>
        </div>
      </section>

      <section>
        <h2>Live Arena Stats</h2>
        <div className="stats-grid">
          <div className="card">
            <p className="stat-label">🏆 Current Jackpot</p>
            <p className="jackpot-value">{(survivors * 1000).toLocaleString()} $MRYL</p>
          </div>
          <div className="card">
            <p className="stat-label">👥 Holders Entered</p>
            <p className="stat-value">{wallets.length}</p>
          </div>
          <div className="card">
            <p className="stat-label">💀 Survivors Remaining</p>
            <p className="stat-value">{survivors}</p>
          </div>
          <div className="card">
            <p className="stat-label">⏱ Next Elimination</p>
            <p className="stat-value">{countdown}</p>
          </div>
          <div className="card">
            <p className="stat-label">🪙 Minimum Holding</p>
            <p className="stat-value">10,000 $MRYL</p>
          </div>
        </div>
      </section>

      <section>
        <h2>Eligibility Checker</h2>
        <div className="card">
          <label htmlFor="wallet-check">Wallet Address</label>
          <input
            id="wallet-check"
            value={checkInput}
            onChange={(event) => setCheckInput(event.target.value)}
            placeholder="Enter wallet address..."
          />
          <button onClick={runEligibilityCheck}>Check Eligibility</button>

          {checkResult && (
            <div className="card result-card">
              <p className={`result-status ${checkResult.eligible ? 'status-good' : 'status-bad'}`}>
                {checkResult.eligible ? '✅ Eligible' : '❌ Not Eligible'}
              </p>
              <div className="result-list">
                <p>Wallet Balance: {checkResult.balance.toLocaleString()} $MRYL</p>
                <p>Lives Remaining: {checkResult.lives}</p>
                <p>
                  Arena Status:{' '}
                  {checkResult.eligible
                    ? checkResult.arenaStatus === 'Eliminated'
                      ? 'Eliminated'
                      : 'In Arena'
                    : 'Not Entered'}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2>Survivor Table</h2>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Wallet</th>
                <th>Holdings</th>
                <th>Lives</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.id} className={wallet.status === 'alive' ? 'alive' : 'eliminated'}>
                  <td>{wallet.rank}</td>
                  <td>{shortenWallet(wallet.wallet)}</td>
                  <td>{wallet.holdings.toLocaleString()} $MRYL</td>
                  <td className="lives-heart">{'❤️'.repeat(wallet.lives)}</td>
                  <td>
                    <span className={wallet.status === 'alive' ? 'status-alive' : 'status-eliminated'}>
                      {wallet.status === 'alive' ? 'ALIVE' : 'ELIMINATED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {gameOver && winner && (
        <section className="winner-banner">
          <h2>🏆 FINAL SURVIVOR 🏆</h2>
          <p className="winner-wallet">{winner.wallet}</p>
          <p className="winner-jackpot">JACKPOT WON: 1,000 $MRYL</p>
          <button onClick={startNewSeason}>Start New Season</button>
        </section>
      )}

      <section>
        <h2>⚡ Hourly Elimination</h2>
        <p>The arena is merciless. One wallet falls every hour.</p>
        <div className="card" style={{ marginTop: '0.8rem' }}>
          <button className="elimination-button" onClick={simulateElimination} disabled={survivors <= 1 || gameOver}>
            ⚔️ Simulate Hourly Elimination
          </button>
          {eliminationMessage && <div className="alert-box">{eliminationMessage}</div>}
        </div>
      </section>

      <section>
        <h2>Previous Winners</h2>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th>Winner</th>
                <th>Jackpot</th>
              </tr>
            </thead>
            <tbody>
              {PREVIOUS_WINNERS.map((winnerItem) => (
                <tr key={winnerItem.season}>
                  <td>{winnerItem.season}</td>
                  <td>{winnerItem.winner}</td>
                  <td>{winnerItem.jackpot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
