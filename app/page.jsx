'use client';

// ─── ROUND CONTROL ───────────────────────────────────────────────
// Set to true to start the round countdown. Redeploy to activate.
const ROUND_ACTIVE = false;
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const shortenWallet = (wallet) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

const formatCountdown = (totalSeconds) => {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export default function Home() {
  const [wallets, setWallets] = useState([]);
  const [phase, setPhase] = useState('waiting');
  const [eliminationMessage, setEliminationMessage] = useState(null);
  const [winner, setWinner] = useState(null);
  const [countdown, setCountdown] = useState('60:00');
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);

  const countdownRef = useRef(3600);
  const countdownTimerRef = useRef(null);
  const simulationRef = useRef(null);
  // Always holds the latest wallets value so simulation useEffect can read it
  // without listing wallets as a dependency (which would re-trigger the animation).
  const walletsRef = useRef([]);

  const survivors = wallets.filter((w) => w.status === 'alive').length;
  const jackpot = (wallets.length * 1000).toLocaleString();

  // Keep walletsRef in sync with the wallets state
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  // On mount: if ROUND_ACTIVE, automatically start the round countdown
  useEffect(() => {
    if (ROUND_ACTIVE) {
      countdownRef.current = 3600;
      setCountdown(formatCountdown(countdownRef.current));
      setPhase('live');
    }
  }, []);

  // Countdown ticker — only active in 'live' phase
  useEffect(() => {
    if (phase !== 'live') return;

    countdownTimerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        countdownRef.current = 0;
        clearInterval(countdownTimerRef.current);
        setCountdown('00:00');
        setPhase('simulating');
      } else {
        setCountdown(formatCountdown(countdownRef.current));
      }
    }, 1000);

    return () => clearInterval(countdownTimerRef.current);
  }, [phase]);

  // Simulation animation — triggers when phase becomes 'simulating'
  useEffect(() => {
    if (phase !== 'simulating') return;

    // Read the current wallets via ref to avoid a stale closure without
    // listing wallets as a dependency (which would re-run the animation
    // on every wallet update during the simulation itself).
    const snapshot = walletsRef.current.filter((w) => w.status === 'alive');

    if (snapshot.length === 0) {
      setPhase('winner');
      return;
    }

    // Fisher-Yates shuffle to build elimination order
    const shuffled = [...snapshot];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Last wallet in shuffled order is the winner; everyone else is eliminated
    const winnerWallet = shuffled[shuffled.length - 1];
    const eliminationOrder = shuffled.slice(0, -1);

    let step = 0;

    simulationRef.current = setInterval(() => {
      if (step >= eliminationOrder.length) {
        clearInterval(simulationRef.current);
        setWinner(winnerWallet);
        setPhase('winner');
        return;
      }

      const target = eliminationOrder[step];
      setWallets((prev) => prev.map((w) => (w.id === target.id ? { ...w, status: 'eliminated' } : w)));
      setEliminationMessage(`💀 Wallet ${shortenWallet(target.wallet)} has been knocked out!`);
      step++;
    }, 300);

    return () => clearInterval(simulationRef.current);
  }, [phase]);

  const resetRound = () => {
    clearInterval(countdownTimerRef.current);
    clearInterval(simulationRef.current);
    setWallets([]);
    setPhase('waiting');
    setWinner(null);
    setEliminationMessage(null);
    countdownRef.current = 3600;
    setCountdown('60:00');
  };

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
      balance: 0,
      lives: 0,
      arenaStatus: 'Not Entered',
    });
  };

  const countdownDisplay = () => {
    if (phase === 'simulating') return 'DRAWING...';
    if (phase === 'winner') return 'ROUND OVER';
    return countdown;
  };

  const heroBadgeLabel = () => {
    if (phase === 'live') return 'LIVE';
    if (phase === 'simulating') return 'DRAWING';
    if (phase === 'winner') return 'ENDED';
    return 'WAITING';
  };

  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">🏆 SEASON 1 · {heroBadgeLabel()}</div>
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

      {/* Simulating banner */}
      {phase === 'simulating' && (
        <section className="simulating-banner">⚡ DRAWING WINNER... WALLETS FALLING ⚡</section>
      )}

      {/* Winner banner */}
      {phase === 'winner' && winner && (
        <section className="winner-banner">
          <h2 className="winner-title">🏆 WINNER THIS ROUND 🏆</h2>
          <p className="winner-wallet">{winner.wallet}</p>
          <p className="winner-jackpot">JACKPOT: {jackpot} $MRYL</p>
          <p className="winner-next">Next Round Starting Soon...</p>
          <button className="reset-button" onClick={resetRound}>
            Reset Round
          </button>
        </section>
      )}

      {/* Knockout message during simulation */}
      {phase === 'simulating' && eliminationMessage && (
        <div className="alert-box" style={{ margin: '1rem 0' }}>
          {eliminationMessage}
        </div>
      )}

      {/* Live Arena Stats */}
      <section>
        <h2>Live Arena Stats</h2>
        <div className="stats-grid">
          <div className="card">
            <p className="stat-label">🏆 Current Jackpot</p>
            <p className="jackpot-value">{jackpot} $MRYL</p>
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
            <p className="stat-label">⏱ Round Timer</p>
            {phase === 'waiting' ? (
              <p className="stat-value" style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                Round not started yet
              </p>
            ) : (
              <p className="stat-value">{countdownDisplay()}</p>
            )}
          </div>
          <div className="card">
            <p className="stat-label">🪙 Minimum Holding</p>
            <p className="stat-value">10,000 $MRYL</p>
          </div>
        </div>
      </section>

      {/* Eligibility Checker */}
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

      {/* Survivor Table */}
      <section>
        <h2>Survivor Table</h2>
        <div className="card table-wrap">
          {wallets.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1.5rem 0' }}>
              Waiting for holders to enter the arena...
            </p>
          ) : (
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
          )}
        </div>
      </section>
    </main>
  );
}
