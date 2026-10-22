import { useEffect, useRef, useState } from 'react';
import { Segmented } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { formatPretty } from '@/engines/units/quantity';
import { mulberry32 } from '@/lib/random';
import { prefersReducedMotion, Slider, VisualFrame } from './controls';

const fx = (v: number, d = 3) => formatPretty(v, d);

/* ------------------------------------------------------------------ */
/* Convention récepteur                                                */
/* ------------------------------------------------------------------ */
export function ReceptorConvention() {
  const animate = !prefersReducedMotion();
  return (
    <VisualFrame footer="Le courant conventionnel i sort de la borne + du générateur ; les électrons circulent en sens inverse. Pour la résistance (récepteur), u_R et i sont fléchés en sens opposés.">
      <svg
        viewBox="0 0 320 170"
        className="w-full"
        role="img"
        aria-label="Circuit : générateur et résistance, électrons circulant à l’opposé du courant"
      >
        <defs>
          <marker
            id="arr"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--primary)" />
          </marker>
          <marker
            id="arr-t"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--teal)" />
          </marker>
        </defs>
        <path
          id="loop"
          d="M60 40 H260 V130 H60 Z"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="2"
        />
        <circle cx="60" cy="85" r="18" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
        <text x="60" y="80" textAnchor="middle" fontSize="13" fill="var(--text)">
          +
        </text>
        <text x="60" y="97" textAnchor="middle" fontSize="13" fill="var(--text)">
          −
        </text>
        <text x="22" y="89" fontSize="12" fill="var(--text)">
          E
        </text>
        <rect
          x="250"
          y="65"
          width="20"
          height="40"
          fill="var(--surface)"
          stroke="var(--text)"
          strokeWidth="2"
        />
        <text x="278" y="89" fontSize="12" fill="var(--text)">
          R
        </text>
        <line
          x1="140"
          y1="28"
          x2="190"
          y2="28"
          stroke="var(--primary)"
          strokeWidth="2.5"
          markerEnd="url(#arr)"
        />
        <text x="165" y="20" textAnchor="middle" fontSize="12" fill="var(--primary)">
          i
        </text>
        <line
          x1="300"
          y1="110"
          x2="300"
          y2="62"
          stroke="var(--teal)"
          strokeWidth="2.5"
          markerEnd="url(#arr-t)"
        />
        <text x="306" y="92" fontSize="12" fill="var(--teal)">
          u_R
        </text>
        {Array.from({ length: 8 }).map((_, k) => (
          <circle key={k} r="4" fill="var(--text)" opacity="0.75">
            {animate ? (
              <animateMotion
                dur="8s"
                repeatCount="indefinite"
                begin={`${-k}s`}
                keyPoints="1;0"
                keyTimes="0;1"
                calcMode="linear"
              >
                <mpath href="#loop" />
              </animateMotion>
            ) : null}
          </circle>
        ))}
        <text x="160" y="155" textAnchor="middle" fontSize="11" fill="var(--muted)">
          ● électrons : sens inverse du courant
        </text>
      </svg>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Vitesse de dérive                                                   */
/* ------------------------------------------------------------------ */
export function DriftVisual() {
  const [u, setU] = useState(10);
  const canvas = useRef<HTMLCanvasElement>(null);
  const v = ((1.6e-19 * 3e-14) / 9.1e-31) * (u / 10); // ℓ = 10 m
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const rng = mulberry32(3);
    const W = c.width;
    const H = c.height;
    const pts = Array.from({ length: 28 }, () => ({
      x: rng() * W,
      y: 10 + rng() * (H - 20),
      vx: 0,
      vy: 0,
    }));
    const color =
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#5b4fd1';
    const reduced = prefersReducedMotion();
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = color;
      for (const p of pts) {
        if (!reduced) {
          // agitation thermique (marche aléatoire) + dérive vers la gauche (opposée à E)
          p.vx = (rng() - 0.5) * 6 - u * 0.05;
          p.vy = (rng() - 0.5) * 6;
          p.x += p.vx;
          p.y = Math.min(H - 6, Math.max(6, p.y + p.vy));
          if (p.x < 0) p.x += W;
          if (p.x > W) p.x -= W;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [u]);
  return (
    <VisualFrame footer="Animation qualitative : la dérive est fortement exagérée pour être visible. En réalité l’agitation (≈ 10⁶ m/s) est des centaines de millions de fois plus rapide que la dérive (mm/s).">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>A (+)</span>
        <span>E → vers les potentiels décroissants</span>
        <span>B (0 V)</span>
      </div>
      <canvas
        ref={canvas}
        width={600}
        height={120}
        className="mt-1 h-28 w-full rounded-xl bg-surface"
        aria-label="Électrons agités qui dérivent lentement vers la gauche, à l’opposé du champ"
        role="img"
      />
      <div className="mt-3">
        <Slider
          label="Tension u (fil de cuivre, ℓ = 10 m)"
          value={u}
          min={0}
          max={20}
          step={1}
          onChange={setU}
          display={`${u} V`}
        />
      </div>
      <p className="mt-2 text-sm">
        Vitesse de dérive (modèle de Drude) :{' '}
        <strong className="tabular-nums">{fx(v * 1e3)} mm/s</strong>
      </p>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Bandes d'énergie                                                    */
/* ------------------------------------------------------------------ */
export function BandDiagram() {
  const [mat, setMat] = useState<'isolant' | 'sc' | 'metal'>('sc');
  const [T, setT] = useState(300);
  const gapPx = mat === 'isolant' ? 90 : mat === 'sc' ? 40 : -20;
  // Population qualitative de la BC : ∝ exp(−Eg/2kT) (SC : 1,12 eV ; isolant : ~6 eV)
  const Eg = mat === 'isolant' ? 6 : 1.12;
  const kT = 8.617e-5 * T;
  const occupancy = mat === 'metal' ? 1 : T === 0 ? 0 : Math.exp(-Eg / (2 * kT));
  const nElectrons =
    mat === 'metal'
      ? 6
      : Math.min(6, Math.round(occupancy / 1e-10 > 1 ? Math.log10(occupancy / 1e-10) : 0));
  const vbTop = 150;
  const cbBottom = vbTop - 30 - gapPx;
  const fermi = mat === 'metal' ? cbBottom + 30 : (vbTop - 30 + cbBottom) / 2 + 15;
  return (
    <VisualFrame footer="Représentation qualitative : le nombre d’électrons dessinés en bande de conduction suit l’ordre de grandeur de exp(−E_g/2k_BT), compressé sur une échelle logarithmique.">
      <Segmented
        label="Matériau"
        value={mat}
        onChange={setMat}
        options={[
          { value: 'isolant', label: 'Isolant' },
          { value: 'sc', label: 'Semi-conducteur' },
          { value: 'metal', label: 'Conducteur' },
        ]}
      />
      <svg
        viewBox="0 0 320 180"
        className="mt-3 w-full"
        role="img"
        aria-label={`Diagramme de bandes : ${mat}, ${T} K`}
      >
        <text x="12" y="16" fontSize="11" fill="var(--muted)">
          énergie ↑
        </text>
        <rect
          x="60"
          y={cbBottom - 40}
          width="160"
          height="40"
          rx="4"
          fill="var(--warning)"
          opacity="0.35"
        />
        <text x="230" y={cbBottom - 16} fontSize="11" fill="var(--text)">
          bande de conduction
        </text>
        <rect
          x="60"
          y={vbTop - 30}
          width="160"
          height="30"
          rx="4"
          fill="var(--muted)"
          opacity="0.35"
        />
        <text x="230" y={vbTop - 11} fontSize="11" fill="var(--text)">
          bande de valence
        </text>
        {mat !== 'metal' && (
          <>
            <line
              x1="40"
              y1={cbBottom}
              x2="40"
              y2={vbTop - 30}
              stroke="var(--teal)"
              strokeWidth="1.5"
            />
            <text x="10" y={(cbBottom + vbTop - 30) / 2 + 4} fontSize="11" fill="var(--teal)">
              E_g
            </text>
          </>
        )}
        <line
          x1="55"
          y1={fermi}
          x2="225"
          y2={fermi}
          stroke="var(--primary)"
          strokeDasharray="5 4"
        />
        <text x="230" y={fermi + 4} fontSize="10" fill="var(--primary)">
          niveau de Fermi
        </text>
        {Array.from({ length: nElectrons }).map((_, i) => (
          <circle
            key={`e${i}`}
            cx={80 + i * 24}
            cy={cbBottom - (mat === 'metal' ? 8 : 12)}
            r="6"
            fill="var(--primary)"
          />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <circle
            key={`v${i}`}
            cx={80 + i * 24}
            cy={vbTop - 15}
            r="6"
            fill={mat !== 'metal' && i < nElectrons ? 'var(--surface)' : 'var(--text)'}
            stroke="var(--text)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <Slider
        label="Température"
        value={T}
        min={0}
        max={600}
        step={10}
        onChange={setT}
        display={`${T} K`}
      />
      <p className="mt-2 text-sm">
        {mat === 'metal'
          ? 'Bandes qui se recouvrent : le niveau de Fermi est dans une bande partiellement remplie. Des électrons libres existent à toute température.'
          : mat === 'isolant'
            ? 'Gap trop grand : quasiment aucun électron ne passe en bande de conduction, même à haute température.'
            : T === 0
              ? 'À 0 K : bande de conduction vide, le semi-conducteur se comporte comme un isolant.'
              : 'Quelques électrons franchissent le gap et laissent des trous (cercles vides) : la conductivité augmente avec T.'}
      </p>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Dopage N et P                                                       */
/* ------------------------------------------------------------------ */
export function DopingVisual() {
  const [type, setType] = useState<'i' | 'N' | 'P'>('N');
  const size = 5;
  const cell = 56;
  const center = 2;
  return (
    <VisualFrame footer="Modèle des liaisons, simplifié en 2D (le vrai cristal est tridimensionnel, tétraédrique). Chaque trait représente une paire d’électrons de liaison.">
      <Segmented
        label="Dopage"
        value={type}
        onChange={setType}
        options={[
          { value: 'i', label: 'Silicium pur' },
          { value: 'N', label: 'Phosphore (N)' },
          { value: 'P', label: 'Bore (P)' },
        ]}
      />
      <svg
        viewBox={`0 0 ${size * cell} ${size * cell}`}
        className="mx-auto mt-3 w-full max-w-xs"
        role="img"
        aria-label="Réseau cristallin de silicium avec un atome dopant au centre"
      >
        {Array.from({ length: size }).flatMap((_, r) =>
          Array.from({ length: size }).map((__, c) => {
            const x = c * cell + cell / 2;
            const y = r * cell + cell / 2;
            const isDopant = type !== 'i' && r === center && c === center;
            return (
              <g key={`${r}-${c}`}>
                {c < size - 1 && (
                  <line
                    x1={x + 14}
                    y1={y}
                    x2={x + cell - 14}
                    y2={y}
                    stroke="var(--muted)"
                    strokeWidth="3"
                    opacity={isDopant && type === 'P' ? 1 : 0.6}
                    strokeDasharray={isDopant && type === 'P' && c === center ? '4 4' : undefined}
                  />
                )}
                {r < size - 1 && (
                  <line
                    x1={x}
                    y1={y + 14}
                    x2={x}
                    y2={y + cell - 14}
                    stroke="var(--muted)"
                    strokeWidth="3"
                    opacity="0.6"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r="14"
                  fill={
                    isDopant ? (type === 'N' ? 'var(--primary)' : 'var(--teal)') : 'var(--surface)'
                  }
                  stroke="var(--text)"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill={isDopant ? '#fff' : 'var(--text)'}
                >
                  {isDopant ? (type === 'N' ? 'P⁺' : 'B⁻') : 'Si'}
                </text>
              </g>
            );
          }),
        )}
        {type === 'N' && (
          <g>
            <circle
              cx={center * cell + cell / 2 + 26}
              cy={center * cell + cell / 2 - 24}
              r="6"
              fill="var(--primary)"
            />
            <text
              x={center * cell + cell / 2 + 36}
              y={center * cell + cell / 2 - 32}
              fontSize="10"
              fill="var(--primary)"
            >
              e⁻ libre
            </text>
          </g>
        )}
        {type === 'P' && (
          <g>
            <circle
              cx={center * cell + cell + 18}
              cy={center * cell + cell / 2}
              r="6"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="2"
            />
            <text
              x={center * cell + cell + 4}
              y={center * cell + cell / 2 - 12}
              fontSize="10"
              fill="var(--teal)"
            >
              trou
            </text>
          </g>
        )}
      </svg>
      <p className="mt-2 text-sm">
        {type === 'i' &&
          'Chaque atome de silicium partage ses 4 électrons de valence avec ses voisins : aucune charge libre à 0 K.'}
        {type === 'N' &&
          'Le phosphore (5 électrons de valence) utilise 4 électrons pour les liaisons ; le 5ᵉ est libéré par l’agitation thermique. Il reste un ion P⁺ fixe : le cristal reste neutre.'}
        {type === 'P' &&
          'Le bore (3 électrons de valence) ne complète que 3 liaisons ; un électron voisin vient combler la 4ᵉ, ce qui crée un trou mobile. Il reste un ion B⁻ fixe.'}
      </p>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Conduction vs diffusion                                             */
/* ------------------------------------------------------------------ */
export function ConductionDiffusion() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    const half = W / 2 - 10;
    const rng = mulberry32(11 + run);
    const drift = Array.from({ length: 30 }, () => ({ x: rng() * half, y: 15 + rng() * (H - 30) }));
    const diff = Array.from({ length: 40 }, () => ({
      x: half + 30 + rng() * 25,
      y: 15 + rng() * (H - 30),
    }));
    const css = getComputedStyle(document.documentElement);
    const c1 = css.getPropertyValue('--primary').trim() || '#5b4fd1';
    const c2 = css.getPropertyValue('--teal').trim() || '#0f8f86';
    const line = css.getPropertyValue('--border').trim() || '#ddd';
    const reduced = prefersReducedMotion();
    let raf = 0;
    let frames = 0;
    const step = () => {
      frames++;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      for (const p of drift) {
        if (!reduced) {
          p.x += (rng() - 0.5) * 3 + 0.8;
          p.y = Math.min(H - 5, Math.max(5, p.y + (rng() - 0.5) * 3));
          if (p.x > half) p.x -= half;
        }
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const p of diff) {
        if (!reduced) {
          p.x = Math.min(W - 5, Math.max(W / 2 + 5, p.x + (rng() - 0.5) * 4));
          p.y = Math.min(H - 5, Math.max(5, p.y + (rng() - 0.5) * 4));
        }
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced && frames < 1500) raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return (
    <VisualFrame footer="Gauche : un champ uniforme entraîne les porteurs (courant de conduction) — leur agitation reste désordonnée. Droite : sans champ, des porteurs concentrés s’étalent d’eux-mêmes (courant de diffusion, loi de Fick).">
      <div className="flex justify-between text-xs font-medium text-muted">
        <span>Dérive : champ E →</span>
        <span>Diffusion : aucun champ</span>
      </div>
      <canvas
        ref={canvas}
        width={600}
        height={140}
        className="mt-1 h-32 w-full rounded-xl bg-surface"
        role="img"
        aria-label="Comparaison dérive et diffusion"
      />
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => setRun((r) => r + 1)}>
        Recommencer
      </Button>
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Jonction PN                                                         */
/* ------------------------------------------------------------------ */
export function PnJunction() {
  const [mode, setMode] = useState<'eq' | 'direct' | 'inverse'>('eq');
  const zce = mode === 'eq' ? 60 : mode === 'direct' ? 24 : 110;
  const W = 320;
  const mid = W / 2;
  const left = mid - zce / 2;
  const right = mid + zce / 2;
  const rng = mulberry32(5);
  const holes = Array.from({ length: 14 }, () => ({
    x: 12 + rng() * (left - 24),
    y: 22 + rng() * 76,
  }));
  const elecs = Array.from({ length: 14 }, () => ({
    x: right + 12 + rng() * (W - right - 24),
    y: 22 + rng() * 76,
  }));
  const ions = Math.round(zce / 20);
  const barrier =
    mode === 'eq' ? 'V₀' : mode === 'direct' ? 'V₀ − V_P (abaissée)' : 'V₀ + V_P (augmentée)';
  return (
    <VisualFrame footer="Schéma qualitatif. Ronds vides : trous (côté P) ; ronds pleins : électrons (côté N) ; signes − et + : ions fixes de la zone de charge d’espace.">
      <Segmented
        label="Polarisation"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'eq', label: 'Équilibre' },
          { value: 'direct', label: 'Directe' },
          { value: 'inverse', label: 'Inverse' },
        ]}
      />
      <svg
        viewBox={`0 0 ${W} 150`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Jonction PN, ${mode === 'eq' ? 'à l’équilibre' : `polarisation ${mode}`}`}
      >
        <rect x="4" y="12" width={left - 4} height="96" fill="var(--danger)" opacity="0.15" />
        <rect x={left} y="12" width={zce} height="96" fill="var(--warning)" opacity="0.25" />
        <rect
          x={right}
          y="12"
          width={W - right - 4}
          height="96"
          fill="var(--primary)"
          opacity="0.15"
        />
        {holes.map((h, i) => (
          <circle
            key={`h${i}`}
            cx={h.x}
            cy={h.y}
            r="5"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="2"
          />
        ))}
        {elecs.map((e, i) => (
          <circle key={`e${i}`} cx={e.x} cy={e.y} r="5" fill="var(--primary)" />
        ))}
        {Array.from({ length: ions }).flatMap((_, k) => [
          <text
            key={`m${k}`}
            x={left + 8}
            y={30 + k * (70 / Math.max(1, ions - 1))}
            fontSize="14"
            fill="var(--text)"
          >
            −
          </text>,
          <text
            key={`p${k}`}
            x={right - 16}
            y={30 + k * (70 / Math.max(1, ions - 1))}
            fontSize="14"
            fill="var(--text)"
          >
            +
          </text>,
        ])}
        <text x={left / 2} y="128" textAnchor="middle" fontSize="12" fill="var(--text)">
          P
        </text>
        <text x={(right + W) / 2} y="128" textAnchor="middle" fontSize="12" fill="var(--text)">
          N
        </text>
        <text x={mid} y="128" textAnchor="middle" fontSize="10" fill="var(--muted)">
          ZCE
        </text>
        <line
          x1={right - 6}
          y1="118"
          x2={left + 6}
          y2="118"
          stroke="var(--teal)"
          strokeWidth="2"
          markerEnd="url(#pn-arr)"
        />
        <defs>
          <marker
            id="pn-arr"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--teal)" />
          </marker>
        </defs>
        <text x={mid} y="145" textAnchor="middle" fontSize="10" fill="var(--teal)">
          E_d (de N vers P)
        </text>
      </svg>
      <div className="mt-2 grid gap-1 text-sm">
        <div>
          Barrière : <strong>{barrier}</strong>
        </div>
        <div>
          {mode === 'eq' &&
            'Équilibre : la diffusion des majoritaires est stoppée par le champ interne. Aucun courant global.'}
          {mode === 'direct' &&
            'P relié au potentiel le plus haut : la barrière diminue, la ZCE se rétrécit, la diffusion reprend. La jonction est passante.'}
          {mode === 'inverse' &&
            'P relié au potentiel le plus bas : la barrière augmente, la ZCE s’élargit. La jonction est bloquante (seul un faible courant de minoritaires, −I_S).'}
        </div>
      </div>
    </VisualFrame>
  );
}
