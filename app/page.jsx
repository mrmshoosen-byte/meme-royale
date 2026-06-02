'use client';

// ─── ROUND CONTROL ───────────────────────────────────────────────
// Set to true to start the round countdown. Redeploy to activate.
const ROUND_ACTIVE = false;
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const shortenWallet = (wallet) => `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;

// ─── Arena Circle ─────────────────────────────────────────────────
const CANVAS_SIZE = 500;
const DOT_RADIUS = 7;
const ARENA_RADIUS = CANVAS_SIZE / 2 - 12;
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;

function getWalletColor(index) {
  return `hsl(${(index * 18) % 360}, 90%, 60%)`;
}

function ArenaCircle({ wallets, phase }) {
  const canvasRef = useRef(null);
  const dotsRef = useRef([]);
  const frameRef = useRef(0);
  const prevIdsRef = useRef('');
  const phaseRef = useRef(phase);
  const walletsLenRef = useRef(0);
  const [tooltip, setTooltip] = useState(null);

  // Keep phaseRef current without restarting the animation loop
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Initialize or update dots whenever wallets array changes
  useEffect(() => {
    walletsLenRef.current = wallets.length;
    const currentIds = wallets.map((w) => w.id).join(',');

    if (currentIds !== prevIdsRef.current) {
      // Full reinitialize (new round / wallets loaded)
      prevIdsRef.current = currentIds;
      const newDots = [];

      if (wallets.length === 0) {
        // Placeholder dots for empty state
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * (ARENA_RADIUS - DOT_RADIUS - 10);
          const speed = 0.3 + Math.random() * 0.4;
          const va = Math.random() * Math.PI * 2;
          newDots.push({
            id: `ph-${i}`,
            x: CX + Math.cos(angle) * r,
            y: CY + Math.sin(angle) * r,
            vx: Math.cos(va) * speed,
            vy: Math.sin(va) * speed,
            color: '#555',
            alive: true,
            walletId: null,
            walletData: null,
            placeholder: true,
            flashTimer: 0,
          });
        }
      } else {
        wallets.forEach((wallet, wi) => {
          const color = getWalletColor(wi);
          const livesCount = Math.max(1, wallet.lives || 1);
          for (let li = 0; li < livesCount; li++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * (ARENA_RADIUS - DOT_RADIUS - 10);
            const speed = 0.4 + Math.random() * 0.8;
            const va = Math.random() * Math.PI * 2;
            newDots.push({
              id: `${wallet.id}-${li}`,
              x: CX + Math.cos(angle) * r,
              y: CY + Math.sin(angle) * r,
              vx: Math.cos(va) * speed,
              vy: Math.sin(va) * speed,
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
    } else {
      // Sync alive status only (eliminations during simulation)
      const dots = dotsRef.current;
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
    }
  }, [wallets]);

  // Single rAF loop — starts on mount, reads all state from refs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frameId;

    const loop = () => {
      const p = phaseRef.current;
      const dots = dotsRef.current;
      frameRef.current++;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Arena background fill
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, ARENA_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0f';
      ctx.fill();
      ctx.restore();

      if (p !== 'winner') {
        // Update dot positions
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
            const proj = dot.vx * nx + dot.vy * ny;
            dot.vx -= 2 * proj * nx;
            dot.vy -= 2 * proj * ny;
            const overlap = dist + DOT_RADIUS - ARENA_RADIUS;
            dot.x -= nx * overlap;
            dot.y -= ny * overlap;
          }
        });

        // Dot-dot collision response
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
              const aProj = a.vx * nx + a.vy * ny;
              const bProj = b.vx * nx + b.vy * ny;
              a.vx += (bProj - aProj) * nx;
              a.vy += (bProj - aProj) * ny;
              b.vx += (aProj - bProj) * nx;
              b.vy += (aProj - bProj) * ny;
            }
          }
        }
      }

      // Draw each dot
      dots.forEach((dot) => {
        ctx.save();

        // Red flash ripple when eliminated
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
        } else if (p === 'winner') {
          // Pulsing gold glow for surviving dot(s)
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

      // Empty state label
      if (walletsLenRef.current === 0) {
        ctx.save();
        ctx.fillStyle = '#666';
        ctx.font = '14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Waiting for holders...', CX, CY);
        ctx.restore();
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frameId);
  }, []); // intentionally empty — all mutable state read via refs

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const dots = dotsRef.current;
    let found = null;
    for (const dot of dots) {
      if (dot.placeholder) continue;
      const dx = dot.x - mx;
      const dy = dot.y - my;
      if (dx * dx + dy * dy <= (DOT_RADIUS + 4) * (DOT_RADIUS + 4)) {
        found = dot;
        break;
      }
    }

    if (found && found.walletData) {
      setTooltip({
        x: e.clientX + 14,
        y: e.clientY + 14,
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
      <p className="arena-subtitle">Each dot = one life. Hover to reveal wallet.</p>
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
          <div className="arena-tooltip-wallet">
            {shortenWallet(tooltip.walletData.wallet)}
          </div>
          <div>{tooltip.walletData.holdings.toLocaleString()} $MRYL</div>
          <div>❤️ x {tooltip.walletData.lives}</div>
          <div className={tooltip.alive ? 'arena-tooltip-alive' : 'arena-tooltip-eliminated'}>
            {tooltip.alive ? 'ALIVE' : 'ELIMINATED'}
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

      {/* Arena Circle */}
      <section>
        <ArenaCircle wallets={wallets} phase={phase} />
      </section>
    </main>
  );
}
