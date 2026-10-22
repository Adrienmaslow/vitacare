import { useState } from 'react';
import { Tex } from '@/components/ui/Math';
import { Segmented } from '@/components/ui/Switch';
import { formatPretty } from '@/engines/units/quantity';
import { Slider, VisualFrame } from './controls';
import { texNum } from '@/lib/format';

const fx = (v: number, d = 3) => formatPretty(v, d);

const MATERIALS = [
  { id: 'cu', label: 'Cuivre', rho: 1.7e-8 },
  { id: 'al', label: 'Aluminium', rho: 2.8e-8 },
  { id: 'ni', label: 'Nichrome', rho: 1.1e-6 },
  { id: 'c', label: 'Carbone', rho: 1 / 2.5e4 },
] as const;

/** R = ρℓ/S : influence du matériau et de la géométrie. */
export function ResistanceExplorer() {
  const [mat, setMat] = useState<(typeof MATERIALS)[number]['id']>('cu');
  const [L, setL] = useState(10);
  const [d, setD] = useState(1);
  const rho = MATERIALS.find((m) => m.id === mat)!.rho;
  const S = Math.PI * ((d * 1e-3) / 2) ** 2;
  const R = (rho * L) / S;
  const w = 40 + (L / 100) * 240;
  const h = 6 + d * 7;
  return (
    <VisualFrame footer="Valeurs de résistivité usuelles à 20 °C (carbone : γ = 2,5·10⁴ S/m, comme dans le cours). La géométrie est schématique.">
      <Segmented
        label="Matériau"
        value={mat}
        onChange={setMat}
        options={MATERIALS.map((m) => ({ value: m.id, label: m.label }))}
      />
      <svg
        viewBox="0 0 320 70"
        className="my-3 h-20 w-full"
        role="img"
        aria-label={`Fil de ${L} m et ${d} mm de diamètre`}
      >
        <ellipse cx={20} cy={35} rx={4} ry={h / 2} fill="var(--teal)" opacity="0.6" />
        <rect x={20} y={35 - h / 2} width={w} height={h} fill="var(--teal)" opacity="0.35" />
        <ellipse cx={20 + w} cy={35} rx={4} ry={h / 2} fill="var(--teal)" />
        <text x={20 + w / 2} y={65} textAnchor="middle" fontSize="10" fill="var(--muted)">
          ℓ = {L} m
        </text>
      </svg>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider
          label="Longueur ℓ"
          value={L}
          min={1}
          max={100}
          step={1}
          onChange={setL}
          display={`${L} m`}
        />
        <Slider
          label="Diamètre d"
          value={d}
          min={0.2}
          max={5}
          step={0.1}
          onChange={setD}
          display={`${fx(d, 2)} mm`}
        />
      </div>
      <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
        <Tex
          tex={String.raw`R = \rho\frac{\ell}{S} = ${texNum(rho, 2)}\times\frac{${L}}{${texNum(S, 3)}}`}
        />
        <div className="mt-1 text-lg font-semibold text-navy tabular-nums">R ≈ {fx(R)} Ω</div>
        <div className="text-xs text-muted">
          Section S = π(d/2)² ≈ {fx(S)} m². Double ℓ : R double. Double d : R est divisée par 4.
        </div>
      </div>
    </VisualFrame>
  );
}

/** C = ε₀ε_r S/d et tension nécessaire pour une charge fixée. */
export function CapacitorExplorer() {
  const [S, setS] = useState(900);
  const [d, setD] = useState(2);
  const [er, setEr] = useState(1);
  const Q = 3e-10;
  const C = (8.85e-12 * er * S * 1e-6) / (d * 1e-3);
  const U = Q / C;
  const plateH = 20 + (S / 2500) * 40;
  const gap = 10 + d * 12;
  return (
    <VisualFrame footer="Condensateur plan idéal (effets de bord négligés). Charge fixée Q = 3·10⁻¹⁰ C, comme dans l’exercice 1.6.">
      <svg
        viewBox="0 0 320 90"
        className="h-24 w-full"
        role="img"
        aria-label="Schéma du condensateur plan"
      >
        <rect
          x={160 - gap / 2 - 6}
          y={45 - plateH / 2}
          width={6}
          height={plateH}
          fill="var(--primary)"
        />
        <rect x={160 + gap / 2} y={45 - plateH / 2} width={6} height={plateH} fill="var(--teal)" />
        {er > 1 && (
          <rect
            x={160 - gap / 2}
            y={45 - plateH / 2}
            width={gap}
            height={plateH}
            fill="var(--warning)"
            opacity="0.25"
          />
        )}
        <text x={160 - gap / 2 - 14} y={48} textAnchor="end" fontSize="12" fill="var(--text)">
          +Q
        </text>
        <text x={160 + gap / 2 + 16} y={48} fontSize="12" fill="var(--text)">
          −Q
        </text>
        <text x={160} y={85} textAnchor="middle" fontSize="10" fill="var(--muted)">
          d = {d} mm{er > 1 ? ` · diélectrique ε_r = ${er}` : ' · vide'}
        </text>
      </svg>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider
          label="Surface S"
          value={S}
          min={100}
          max={2500}
          step={50}
          onChange={setS}
          display={`${S} mm²`}
        />
        <Slider
          label="Distance d"
          value={d}
          min={0.5}
          max={5}
          step={0.5}
          onChange={setD}
          display={`${fx(d, 2)} mm`}
        />
      </div>
      <div className="mt-3">
        <Segmented
          label="Diélectrique"
          value={er}
          onChange={setEr}
          options={[
            { value: 1, label: 'Vide (ε_r = 1)' },
            { value: 4, label: 'ε_r = 4' },
            { value: 10, label: 'ε_r = 10' },
          ]}
        />
      </div>
      <div className="mt-3 grid gap-2 rounded-xl bg-surface p-3 text-sm sm:grid-cols-2">
        <div>
          <div className="text-muted">Capacité</div>
          <div className="text-lg font-semibold text-navy tabular-nums">{fx(C * 1e12)} pF</div>
        </div>
        <div>
          <div className="text-muted">Tension pour stocker Q</div>
          <div className="text-lg font-semibold text-navy tabular-nums">{fx(U)} V</div>
        </div>
      </div>
    </VisualFrame>
  );
}

/** Diviseur de tension sans charge. */
export function VoltageDivider() {
  const [R1, setR1] = useState(10);
  const [R2, setR2] = useState(10);
  const [Vs, setVs] = useState(5);
  const V2 = (R2 / (R1 + R2)) * Vs;
  return (
    <VisualFrame footer="Valable si aucun courant ne part au point milieu (pas de charge, ou charge derrière un suiveur).">
      <div className="flex items-end gap-4">
        <div
          className="flex h-36 w-14 flex-col overflow-hidden rounded-lg border border-border"
          aria-hidden
        >
          <div
            className="grid place-items-center bg-primary-soft text-xs text-primary"
            style={{ height: `${(R1 / (R1 + R2)) * 100}%` }}
          >
            R₁
          </div>
          <div
            className="grid place-items-center bg-teal-soft text-xs text-teal"
            style={{ height: `${(R2 / (R1 + R2)) * 100}%` }}
          >
            R₂
          </div>
        </div>
        <div className="flex-1 text-sm">
          <Tex tex={String.raw`V_2 = \frac{R_2}{R_1+R_2}V_s`} />
          <div className="mt-1 text-2xl font-semibold text-navy tabular-nums">V₂ = {fx(V2)} V</div>
          <div className="text-muted">V₁ = {fx(Vs - V2)} V</div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Slider
          label="R₁"
          value={R1}
          min={1}
          max={100}
          step={1}
          onChange={setR1}
          display={`${R1} kΩ`}
        />
        <Slider
          label="R₂"
          value={R2}
          min={1}
          max={100}
          step={1}
          onChange={setR2}
          display={`${R2} kΩ`}
        />
        <Slider
          label="V_s"
          value={Vs}
          min={1}
          max={12}
          step={0.5}
          onChange={setVs}
          display={`${fx(Vs)} V`}
        />
      </div>
    </VisualFrame>
  );
}

/** np = n_i² en fonction du dopage (silicium, n_i = 1,5·10¹⁰ cm⁻³). */
export function MassActionExplorer() {
  const [logN, setLogN] = useState(15);
  const [type, setType] = useState<'N' | 'P'>('N');
  const ni = 1.5e10;
  const N = 10 ** logN;
  // Résolution exacte de la neutralité + action de masse.
  const maj = N / 2 + Math.sqrt((N * N) / 4 + ni * ni);
  const min = (ni * ni) / maj;
  const n = type === 'N' ? maj : min;
  const p = type === 'N' ? min : maj;
  const bar = (v: number) => `${Math.max(2, ((Math.log10(v) - 0) / 20) * 100)}%`;
  return (
    <VisualFrame footer="Silicium, n_i = 1,5·10¹⁰ cm⁻³. Valeurs exactes (neutralité + np = n_i²) ; pour N ≫ n_i on retrouve n ≈ N et p = n_i²/N. Barres en échelle logarithmique.">
      <Segmented
        label="Type de dopage"
        value={type}
        onChange={setType}
        options={[
          { value: 'N', label: 'Donneurs (N_D)' },
          { value: 'P', label: 'Accepteurs (N_A)' },
        ]}
      />
      <div className="mt-3">
        <Slider
          label={type === 'N' ? 'N_D' : 'N_A'}
          value={logN}
          min={8}
          max={19}
          step={0.5}
          onChange={setLogN}
          display={`${fx(N, 2)} cm⁻³`}
        />
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        {[
          { k: 'n (électrons)', v: n, c: 'var(--primary)' },
          { k: 'p (trous)', v: p, c: 'var(--teal)' },
        ].map((r) => (
          <div key={r.k}>
            <div className="flex justify-between">
              <span>{r.k}</span>
              <span className="tabular-nums">{fx(r.v)} cm⁻³</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-surface">
              <div className="h-full rounded-full" style={{ width: bar(r.v), background: r.c }} />
            </div>
          </div>
        ))}
        <div className="mt-1 rounded-lg bg-surface p-2 text-center tabular-nums">
          n × p = {fx(n * p)} = n_i² ({fx(ni * ni)})
        </div>
        <div className="text-muted">
          {N < ni / 10
            ? 'Dopage négligeable : n ≈ p ≈ n_i.'
            : N > ni * 10
              ? `Type ${type} : ${type === 'N' ? 'électrons' : 'trous'} majoritaires.`
              : 'Régime intermédiaire : l’approximation n ≈ N n’est pas valable.'}
        </div>
      </div>
    </VisualFrame>
  );
}

/** Barrière de potentiel V₀ en fonction des dopages. */
export function BarrierExplorer() {
  const [logA, setLogA] = useState(16);
  const [logD, setLogD] = useState(17);
  const V0 = 0.026 * Math.log((10 ** logA * 10 ** logD) / 1.5e10 ** 2);
  return (
    <VisualFrame footer="Silicium à l’ambiante : k_BT/e = 0,026 V, n_i = 1,5·10¹⁰ cm⁻³.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider
          label="N_A (côté P)"
          value={logA}
          min={14}
          max={19}
          step={0.5}
          onChange={setLogA}
          display={`${fx(10 ** logA, 2)} cm⁻³`}
        />
        <Slider
          label="N_D (côté N)"
          value={logD}
          min={14}
          max={19}
          step={0.5}
          onChange={setLogD}
          display={`${fx(10 ** logD, 2)} cm⁻³`}
        />
      </div>
      <div className="mt-3 text-2xl font-semibold text-navy tabular-nums">V₀ ≈ {fx(V0)} V</div>
    </VisualFrame>
  );
}
