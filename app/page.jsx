'use client';

// ─── ROUND CONTROL ───────────────────────────────────────────────
// Set to true to start the round countdown. Redeploy to activate.
const ROUND_ACTIVE = true;
// ─────────────────────────────────────────────────────────────────

// ─── TOKEN CONFIG ─────────────────────────────────────────────────
const TOKEN_TICKER = '$TOKEN';
// ─────────────────────────────────────────────────────────────────

// ─── JACKPOT CONFIG ───────────────────────────────────────────────
const JACKPOT_DISPLAY = '$12 USD';
// ─────────────────────────────────────────────────────────────────

// ─── SOLANA RPC CONFIG ────────────────────────────────────────────
const TOKEN_MINT = '8t2phMFTJX6C3PpEehwdR4X8kP4X8S4cqyZBhRz9pump';
const HOLDER_REFRESH_INTERVAL_SECONDS = 10;
// ─────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';

const MINIMUM_ENTRY_LABEL = '10,000 Tokens';
const HOLDER_RETRY_MESSAGE = 'Failed to load holders. Retrying...';

const ENTRY_TIERS = [
  { minTokens: 500_000, entries: 3 },
  { minTokens: 100_000, entries: 2 },
  { minTokens: 10_000, entries: 1 },
];
const MINIMUM_ENTRY_TOKENS = ENTRY_TIERS[ENTRY_TIERS.length - 1].minTokens;
const MINIMUM_ENTRY_REQUIREMENT = `${MINIMUM_ENTRY_TOKENS.toLocaleString()}+ tokens`;

// Returns seconds remaining until the next top-of-the-hour.
// This is the same value for every user on earth at any given moment.
function getSecondsUntilNextHour() {
  const now = new Date();
  const secondsElapsed = now.getMinutes() * 60 + now.getSeconds();
  return 3600 - secondsElapsed;
}

const shortenWallet = (wallet) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

const formatTokenAmount = (value) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const getEntriesFromTokenAmount = (tokenAmount) => {
  for (const tier of ENTRY_TIERS) {
    if (tokenAmount >= tier.minTokens) return tier.entries;
  }
  return 0;
};

async function fetchHolders(mint) {
  const response = await fetch(`/api/holders?mint=${encodeURIComponent(mint)}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.wallets;
}

// ─── Arena Circle ─────────────────────────────────────────────────
const CANVAS_SIZE = 500;
const DOT_RADIUS = 7;
const ARENA_RADIUS = CANVAS_SIZE / 2 - 12;
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;

function getWalletColor(index) {
  return `hsl(${(index * 18) % 360}, 90%, 60%)`;
}

function ArenaCircle({ wallets, phase, statusText }) {
  const canvasRef = useRef(null);
  const dotsRef = useRef([]);
  const frameRef = useRef(0);
  const prevWalletSignatureRef = useRef('');
  const phaseRef = useRef(phase);
  const walletsLenRef = useRef(0);
  const statusTextRef = useRef(statusText);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    statusTextRef.current = statusText;
  }, [statusText]);

  useEffect(() => {
    walletsLenRef.current = wallets.length;
    const currentSignature = wallets.map((wallet) => `${wallet.id}:${wallet.entries}`).join(',');

    if (currentSignature !== prevWalletSignatureRef.current) {
      prevWalletSignatureRef.current = currentSignature;
      const newDots = [];

      if (wallets.length === 0) {
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * (ARENA_RADIUS - DOT_RADIUS - 10);
          const speed = 0.3 + Math.random() * 0.4;
          const velocityAngle = Math.random() * Math.PI * 2;
          newDots.push({
            id: `ph-${i}`,
            x: CX + Math.cos(angle) * r,
            y: CY + Math.sin(angle) * r,
            vx: Math.cos(velocityAngle) * speed,
            vy: Math.sin(velocityAngle) * speed,
            color: '#555',
            alive: true,
            walletId: null,
            walletData: null,
            placeholder: true,
            flashTimer: 0,
          });
        }
      } else {
        wallets.forEach((wallet, walletIndex) => {
          const color = getWalletColor(walletIndex);
          const entryCount = Math.max(1, wallet.entries || 1);

          for (let entryIndex = 0; entryIndex < entryCount; entryIndex++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * (ARENA_RADIUS - DOT_RADIUS - 10);
            const speed = 0.4 + Math.random() * 0.8;
            const velocityAngle = Math.random() * Math.PI * 2;
            newDots.push({
              id: `${wallet.id}-${entryIndex}`,
              x: CX + Math.cos(angle) * r,
              y: CY + Math.sin(angle) * r,
              vx: Math.cos(velocityAngle) * speed,
              vy: Math.sin(velocityAngle) * speed,
              color,
              alive: wallet.status === 'alive',
              walletId: wallet.id,
              walletData: wallet,
              placeholder: false,
              flashTimer: 0,
            });
          }
        });
      }

      dotsRef.current = newDots;
      return;
    }

    const walletMap = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    const dots = dotsRef.current;

    dots.forEach((dot) => {
      if (!dot.walletId) return;
      const wallet = walletMap.get(dot.walletId);
      if (wallet) dot.walletData = wallet;
    });

    wallets.forEach((wallet) => {
      if (wallet.status === 'eliminated') {
        dots.forEach((dot) => {
          if (dot.walletId === wallet.id && dot.alive) {
            dot.alive = false;
            dot.flashTimer = 10;
          }
        });
      }
    });
  }, [wallets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let frameId;

    const loop = () => {
      const currentPhase = phaseRef.current;
      const dots = dotsRef.current;
      frameRef.current++;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0f';
      ctx.fill();
      ctx.restore();

      if (currentPhase !== 'winner') {
        dots.forEach((dot) => {
          if (!dot.alive) return;
          dot.x += dot.vx;
          dot.y += dot.vy;

          const dx = dot.x - CX;
          const dy = dot.y - CY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist + DOT_RADIUS > ARENA_RADIUS) {
            const nx = dx / dist;
            const ny = dy / dist;
            const projection = dot.vx * nx + dot.vy * ny;
            dot.vx -= 2 * projection * nx;
            dot.vy -= 2 * projection * ny;
            const overlap = dist + DOT_RADIUS - ARENA_RADIUS;
            dot.x -= nx * overlap;
            dot.y -= ny * overlap;
          }
        });

        for (let i = 0; i < dots.length; i++) {
          for (let j = i + 1; j < dots.length; j++) {
            const a = dots[i];
            const b = dots[j];
            if (!a.alive || !b.alive) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = DOT_RADIUS * 2;

            if (distSq < minDist * minDist && distSq > 0) {
              const dist = Math.sqrt(distSq);
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minDist - dist;
              a.x -= nx * overlap * 0.5;
              a.y -= ny * overlap * 0.5;
              b.x += nx * overlap * 0.5;
              b.y += ny * overlap * 0.5;
              const aProjection = a.vx * nx + a.vy * ny;
              const bProjection = b.vx * nx + b.vy * ny;
              a.vx += (bProjection - aProjection) * nx;
              a.vy += (bProjection - aProjection) * ny;
              b.vx += (aProjection - bProjection) * nx;
              b.vy += (aProjection - bProjection) * ny;
            }
          }
        }
      }

      dots.forEach((dot) => {
        ctx.save();

        if (dot.flashTimer > 0) {
          const alpha = dot.flashTimer / 10;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, DOT_RADIUS + (10 - dot.flashTimer) * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 45, 85, ${alpha * 0.5})`;
          ctx.fill();
          dot.flashTimer--;
        }

        if (!dot.alive) {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, DOT_RADIUS * 0.85, 0, Math.PI * 2);
          ctx.fillStyle = '#444';
          ctx.fill();
        } else if (currentPhase === 'winner') {
          const pulse = 0.7 + 0.3 * Math.sin(frameRef.current * 0.06);
          ctx.shadowColor = 'gold';
          ctx.shadowBlur = 20 * pulse;
          ctx.globalAlpha = 0.85 + 0.15 * pulse;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, DOT_RADIUS * (0.9 + 0.2 * pulse), 0, Math.PI * 2);
          ctx.fillStyle = '#ffd700';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = dot.color;
          ctx.fill();
        }

        ctx.restore();
      });

      const arenaMessage = statusTextRef.current || (walletsLenRef.current === 0 ? 'Waiting for holders...' : '');
      if (arenaMessage) {
        ctx.save();
        ctx.fillStyle = '#666';
        ctx.font = '14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(arenaMessage, CX, CY);
        ctx.restore();
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const dots = dotsRef.current;
    let found = null;

    for (const dot of dots) {
      if (dot.placeholder) continue;
      const dx = dot.x - mouseX;
      const dy = dot.y - mouseY;
      if (dx * dx + dy * dy <= (DOT_RADIUS + 4) * (DOT_RADIUS + 4)) {
        found = dot;
        break;
      }
    }

    if (found && found.walletData) {
      const tooltipWidth = Math.min(320, window.innerWidth - 32);
      const tooltipHeight = 120;
      const clampedX = Math.min(Math.max(16, event.clientX + 14), window.innerWidth - tooltipWidth - 16);
      const clampedY = Math.min(Math.max(16, event.clientY + 14), window.innerHeight - tooltipHeight - 16);

      setTooltip({
        x: clampedX,
        y: clampedY,
        walletData: found.walletData,
        alive: found.alive,
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div className="arena-wrap">
      <h2 className="arena-title">THE ARENA</h2>
      <p className="arena-subtitle">Each ball = one entry. Hover to reveal wallet.</p>
      <div className="arena-canvas-container">
        <canvas
          ref={canvasRef}
          className="arena-canvas"
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
      </div>
      {tooltip && (
        <div className="arena-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="arena-tooltip-wallet">{tooltip.walletData.wallet}</div>
          <div>Holdings: {formatTokenAmount(tooltip.walletData.tokenAmount)} tokens</div>
          <div>Entries: {tooltip.walletData.entries}</div>
          <div className={tooltip.alive ? 'arena-tooltip-alive' : 'arena-tooltip-eliminated'}>
            {tooltip.alive ? 'In Draw' : 'Eliminated'}
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────

const formatCountdown = (totalSeconds) => {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const mergeWallets = (currentWallets, incomingWallets, preserveExisting) => {
  if (!preserveExisting) return incomingWallets;

  const incomingById = new Map(incomingWallets.map((wallet) => [wallet.id, wallet]));
  const mergedWallets = currentWallets.map((wallet) => {
    const refreshed = incomingById.get(wallet.id);
    if (!refreshed) return wallet;
    return { ...wallet, ...refreshed, status: wallet.status };
  });

  const existingIds = new Set(currentWallets.map((wallet) => wallet.id));
  incomingWallets.forEach((wallet) => {
    if (!existingIds.has(wallet.id)) mergedWallets.push(wallet);
  });

  return mergedWallets;
};

export default function Home() {
  const [wallets, setWallets] = useState([]);
  const [phase, setPhase] = useState('waiting');
  const [drawMessage, setDrawMessage] = useState(null);
  const [winner, setWinner] = useState(null);
  const [countdown, setCountdown] = useState('--:--');
  const [checkInput, setCheckInput] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [holdersError, setHoldersError] = useState('');

  const countdownRef = useRef(0);
  const countdownTimerRef = useRef(null);
  const simulationRef = useRef(null);
  const walletsRef = useRef([]);
  const retryTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false);

  const holderFetchConfigured = TOKEN_MINT !== 'PASTE_MINT_ADDRESS_HERE';
  const survivors = wallets.filter((wallet) => wallet.status === 'alive').length;
  const arenaStatusText = holdersError || (holdersLoading && wallets.length === 0 ? 'Loading holders...' : '');

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  // ── Clock-synced countdown ──────────────────────────────────────
  // On mount, read the real clock and start counting down to the
  // next top-of-the-hour. Every visitor gets the exact same value.
  useEffect(() => {
    if (!ROUND_ACTIVE) return;

    const initialSeconds = getSecondsUntilNextHour();
    countdownRef.current = initialSeconds;
    setCountdown(formatCountdown(initialSeconds));
    setPhase('live');
  }, []);
  // ───────────────────────────────────────────────────────────────

  const loadHolders = useCallback(
    async ({ preserveExisting = false } = {}) => {
      if (!holderFetchConfigured || isFetchingRef.current) return;

      isFetchingRef.current = true;
      setHoldersLoading(true);
      setHoldersError('');
      clearTimeout(retryTimeoutRef.current);

      try {
        const liveWallets = await fetchHolders(TOKEN_MINT);
        setWallets((currentWallets) =>
          mergeWallets(currentWallets, liveWallets, preserveExisting && currentWallets.length > 0),
        );
      } catch (error) {
        console.error('Failed to load holders', error);
        setHoldersError(HOLDER_RETRY_MESSAGE);
        retryTimeoutRef.current = setTimeout(() => {
          loadHolders({ preserveExisting: true });
        }, 30_000);
      } finally {
        setHoldersLoading(false);
        isFetchingRef.current = false;
      }
    },
    [holderFetchConfigured],
  );

  useEffect(() => {
    clearTimeout(retryTimeoutRef.current);

    if (!holderFetchConfigured) {
      setWallets([]);
      setHoldersLoading(false);
      setHoldersError('');
      return;
    }

    loadHolders();

    return () => clearTimeout(retryTimeoutRef.current);
  }, [holderFetchConfigured, loadHolders]);

  useEffect(() => {
    if (!holderFetchConfigured || HOLDER_REFRESH_INTERVAL_SECONDS <= 0 || !['waiting', 'live'].includes(phase)) return;

    const intervalId = setInterval(() => {
      loadHolders({ preserveExisting: true });
    }, HOLDER_REFRESH_INTERVAL_SECONDS * 1000);

    return () => clearInterval(intervalId);
  }, [holderFetchConfigured, loadHolders, phase]);

  useEffect(() => {
    if (phase !== 'live') return;

    countdownTimerRef.current = setInterval(() => {
      // Always re-derive from real clock so drift is impossible
      const remaining = getSecondsUntilNextHour();
      countdownRef.current = remaining;

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        setCountdown('00:00');
        setPhase('simulating');
      } else {
        setCountdown(formatCountdown(remaining));
      }
    }, 1000);

    return () => clearInterval(countdownTimerRef.current);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'simulating') return;

    const snapshot = walletsRef.current.filter((wallet) => wallet.status === 'alive');

    if (snapshot.length === 0) {
      setPhase('winner');
      return;
    }

    const shuffled = [...snapshot];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

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
      setWallets((currentWallets) =>
        currentWallets.map((wallet) => (wallet.id === target.id ? { ...wallet, status: 'eliminated' } : wallet)),
      );
      setDrawMessage(`🎲 Finalizing the draw... ${shortenWallet(target.wallet)} is out this round.`);
      step++;
    }, 300);

    return () => clearInterval(simulationRef.current);
  }, [phase]);

  const resetRound = () => {
    clearInterval(countdownTimerRef.current);
    clearInterval(simulationRef.current);
    clearTimeout(retryTimeoutRef.current);
    setWallets([]);
    setPhase('waiting');
    setWinner(null);
    setDrawMessage(null);
    setCheckResult(null);

    if (ROUND_ACTIVE) {
      const remaining = getSecondsUntilNextHour();
      countdownRef.current = remaining;
      setCountdown(formatCountdown(remaining));
      setPhase('live');
    } else {
      setCountdown('--:--');
    }

    if (holderFetchConfigured) loadHolders();
  };

  const runEligibilityCheck = () => {
    const query = checkInput.trim().toLowerCase();

    if (!query) {
      setCheckResult(null);
      return;
    }

    const match = wallets.find((wallet) => wallet.wallet.toLowerCase() === query);

    if (match) {
      setCheckResult({
        eligible: true,
        wallet: match.wallet,
        tokenAmount: match.tokenAmount,
        entries: match.entries,
        arenaStatus: match.status === 'alive' ? 'In Draw' : 'Eliminated',
      });
      return;
    }

    setCheckResult({
      eligible: false,
      arenaStatus: 'Not Entered',
      message: `Wallet not found. Hold ${MINIMUM_ENTRY_REQUIREMENT} to enter the arena.`,
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
      <section className="hero">
        <div className="hero-badge">🏆 SEASON 1 · {heroBadgeLabel()}</div>
        <h1 className="hero-title">MEME ROYALE</h1>
        <p className="hero-tagline">Hold. Enter. Win.</p>
        <p className="hero-desc">
          Hold enough tokens to enter the arena. Every hour, one lucky wallet wins the jackpot. The more you hold,
          the more entries you get.
        </p>
        <div className="hero-pills">
          <span>&quot;Hold 10,000+ tokens to enter.&quot;</span>
          <span>&quot;One winner drawn every hour.&quot;</span>
          <span>&quot;More tokens = more entries.&quot;</span>
          <span>&quot;Final winner takes the jackpot.&quot;</span>
          <span>&quot;The more you hold, the better your odds.&quot;</span>
        </div>
      </section>

      {phase === 'simulating' && <section className="simulating-banner">⚡ DRAWING WINNER... ⚡</section>}

      {phase === 'winner' && winner && (
        <section className="winner-banner">
          <h2 className="winner-title">🏆 WINNER THIS ROUND 🏆</h2>
          <p className="winner-wallet">{winner.wallet}</p>
          <p className="winner-jackpot">JACKPOT: {JACKPOT_DISPLAY}</p>
          <p className="winner-next">Jackpot claimed. Next draw starting soon...</p>
          <button className="reset-button" onClick={resetRound}>
            Reset Round
          </button>
        </section>
      )}

      {phase === 'simulating' && drawMessage && (
        <div className="alert-box" style={{ margin: '1rem 0' }}>
          {drawMessage}
        </div>
      )}

      <section>
        <h2>Live Arena</h2>
        <div className="stats-grid">
          <div className="card">
            <p className="stat-label">🏆 Current Jackpot</p>
            <p className="jackpot-value">{JACKPOT_DISPLAY}</p>
          </div>
          <div className="card">
            <p className="stat-label">👥 Wallets Entered</p>
            <p className="stat-value stat-status">{holdersLoading && wallets.length === 0 ? 'Loading...' : wallets.length}</p>
          </div>
          <div className="card">
            <p className="stat-label">🎯 Still In Draw</p>
            <p className="stat-value stat-status">{holdersLoading && wallets.length === 0 ? 'Loading...' : survivors}</p>
          </div>
          <div className="card">
            <p className="stat-label">⏱ Round Timer</p>
            {phase === 'waiting' ? (
              <p className="stat-value" style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                Waiting for the next draw to begin...
              </p>
            ) : (
              <p className="stat-value">{countdownDisplay()}</p>
            )}
          </div>
          <div className="card">
            <p className="stat-label">🪙 Minimum Holding</p>
            <p className="stat-value">{MINIMUM_ENTRY_LABEL}</p>
          </div>
        </div>
      </section>

      <section>
        <h2>Eligibility Checker</h2>
        <div className="card">
          <label htmlFor="wallet-check">Check if your wallet is in the draw</label>
          <div className="eligibility-form">
            <input
              id="wallet-check"
              value={checkInput}
              onChange={(event) => setCheckInput(event.target.value)}
              placeholder="Enter wallet address..."
            />
            <button onClick={runEligibilityCheck}>Check Eligibility</button>
          </div>

          {checkResult && (
            <div className="card result-card">
              <p className={`result-status ${checkResult.eligible ? 'status-good' : 'status-bad'}`}>
                {checkResult.eligible ? '✅ Entered in Draw' : '❌ Not Eligible'}
              </p>
              {checkResult.eligible ? (
                <div className="result-list">
                  <p>Wallet: {checkResult.wallet}</p>
                  <p>Token Amount: {formatTokenAmount(checkResult.tokenAmount)} tokens</p>
                  <p>Entries: {checkResult.entries}</p>
                  <p>Minimum: {MINIMUM_ENTRY_LABEL}</p>
                  <p>Arena Status: {checkResult.arenaStatus}</p>
                </div>
              ) : (
                <>
                  <p className="result-empty">{checkResult.message}</p>
                  <p className="result-empty">Arena Status: {checkResult.arenaStatus}</p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <ArenaCircle wallets={wallets} phase={phase} statusText={arenaStatusText} />
      </section>
    </main>
  );
}
