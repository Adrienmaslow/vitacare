"use client";
/**
 * Graphiques BUDGETLY. Chaque graphique reçoit une description textuelle (aria-label)
 * et un résumé accessible : les lecteurs d'écran n'ont pas à interpréter le SVG.
 */
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmt } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const euro = (v: number) => formatMoney(v, { compact: true });
const axis = { fontSize: 11, fill: "var(--muted)" };

function ChartTooltip({ active, payload, label, labelFormatter }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{labelFormatter && label ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 tabular">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name} : <strong>{formatMoney(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

export function BalanceChart({ data, height = 220 }: { data: { date: string; balance: number }[]; height?: number }) {
  const min = Math.min(...data.map((d) => d.balance));
  const max = Math.max(...data.map((d) => d.balance));
  const last = data[data.length - 1]?.balance ?? 0;
  return (
    <figure aria-label={`Évolution du solde : de ${formatMoney(data[0]?.balance ?? 0)} à ${formatMoney(last)}, minimum ${formatMoney(min)}, maximum ${formatMoney(max)}.`}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7357F6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7357F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={(d) => fmt.day(d)} tick={axis} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tickFormatter={euro} tick={axis} tickLine={false} axisLine={false} width={60} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => fmt.full(l)} />} />
          {min < 0 ? <ReferenceLine y={0} stroke="var(--danger)" strokeDasharray="4 4" /> : null}
          <Area type="monotone" dataKey="balance" name="Solde" stroke="#7357F6" strokeWidth={2.5} fill="url(#balFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function DonutChart({ data, onSelect, selected, centerLabel, centerValue }: {
  data: { key: string; name: string; value: number; color: string }[]; onSelect?: (key: string) => void; selected?: string | null; centerLabel: string; centerValue: string;
}) {
  return (
    <figure className="relative" aria-label={`Répartition : ${data.map((d) => `${d.name} ${formatMoney(d.value)}`).join(", ")}.`}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none"
            onClick={(d: { payload?: { key: string } }) => d.payload && onSelect?.(d.payload.key)} cursor={onSelect ? "pointer" : undefined}>
            {data.map((d) => <Cell key={d.key} fill={d.color} opacity={selected && selected !== d.key ? 0.35 : 1} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted">{centerLabel}</span>
        <span className="font-display text-lg font-bold tabular">{centerValue}</span>
      </div>
    </figure>
  );
}

export function ForecastChart({ history, points, threshold, height = 300 }: {
  history: { date: string; balance: number }[];
  points: { date: string; optimistic: number; realistic: number; pessimistic: number }[];
  threshold: number;
  height?: number;
}) {
  const data = [
    ...history.slice(0, -1).map((h) => ({ date: h.date, reel: h.balance })),
    ...points.map((p, i) => ({
      date: p.date, reel: i === 0 ? history[history.length - 1]?.balance ?? p.realistic : undefined, realiste: p.realistic,
      band: [p.pessimistic, p.optimistic] as [number, number], optimiste: p.optimistic, pessimiste: p.pessimistic,
    })),
  ];
  const end = points[points.length - 1];
  return (
    <figure aria-label={`Prévision : solde réaliste de ${formatMoney(end?.realistic ?? 0)} au ${end ? fmt.full(end.date) : ""}, entre ${formatMoney(end?.pessimistic ?? 0)} (pessimiste) et ${formatMoney(end?.optimistic ?? 0)} (optimiste).`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={(d) => fmt.day(d)} tick={axis} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tickFormatter={euro} tick={axis} tickLine={false} axisLine={false} width={60} />
          <Tooltip content={<ChartTooltip labelFormatter={(l) => fmt.full(l)} />} />
          <ReferenceLine y={0} stroke="var(--danger)" strokeWidth={1.5} label={{ value: "0 €", position: "insideBottomRight", fontSize: 10, fill: "var(--danger)" }} />
          <ReferenceLine y={threshold} stroke="var(--warning)" strokeDasharray="3 5" label={{ value: "Seuil de sécurité", position: "insideTopLeft", fontSize: 10, fill: "var(--warning)" }} />
          <Area dataKey="band" name="Incertitude" stroke="none" fill="#7357F6" fillOpacity={0.12} isAnimationActive={false} />
          <Line dataKey="reel" name="Réel" stroke="#7357F6" strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line dataKey="realiste" name="Réaliste" stroke="#7357F6" strokeWidth={2.5} strokeDasharray="6 5" dot={false} />
          <Line dataKey="optimiste" name="Optimiste" stroke="#22C55E" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
          <Line dataKey="pessimiste" name="Pessimiste" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function BarsChart({ data, bars, xKey, xFormat, height = 240, stacked }: {
  data: Record<string, string | number>[]; bars: { key: string; name: string; color: string }[]; xKey: string; xFormat?: (v: string) => string; height?: number; stacked?: boolean;
}) {
  return (
    <figure aria-label={`Graphique en barres : ${bars.map((b) => b.name).join(", ")} par période.`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tickFormatter={xFormat} tick={axis} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={euro} tick={axis} tickLine={false} axisLine={false} width={60} />
          <Tooltip content={<ChartTooltip labelFormatter={xFormat} />} cursor={{ fill: "var(--surface-2)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={stacked ? 0 : [6, 6, 0, 0]} stackId={stacked ? "s" : undefined} maxBarSize={36} />)}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function LineSeriesChart({ data, lines, xKey, xFormat, height = 240 }: {
  data: Record<string, string | number>[]; lines: { key: string; name: string; color: string; dashed?: boolean }[]; xKey: string; xFormat?: (v: string) => string; height?: number;
}) {
  return (
    <figure aria-label={`Courbes : ${lines.map((l) => l.name).join(", ")}.`}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tickFormatter={xFormat} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickFormatter={euro} tick={axis} tickLine={false} axisLine={false} width={60} />
          <Tooltip content={<ChartTooltip labelFormatter={xFormat} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="var(--chart-grid)" />
          {lines.map((l) => <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2.5} strokeDasharray={l.dashed ? "6 5" : undefined} dot={false} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
