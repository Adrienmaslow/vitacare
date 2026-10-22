import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    color: 'var(--text)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'var(--surface-2)' },
};

export interface Point {
  label: string;
  value: number;
}

/** Barres (une seule série). */
export function SimpleBars({
  data,
  unit,
  color = 'var(--primary)',
  name,
  height = 220,
  max,
}: {
  data: Point[];
  unit: string;
  color?: string;
  name: string;
  height?: number;
  max?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...axis} allowDecimals={false} domain={max ? [0, max] : undefined} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v} ${unit}`, name]} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Courbe (une seule série). */
export function SimpleLine({
  data,
  unit,
  name,
  height = 220,
  domain,
}: {
  data: Point[];
  unit: string;
  name: string;
  height?: number;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" {...axis} minTickGap={12} />
        <YAxis {...axis} domain={domain} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
          formatter={(v) => [`${v} ${unit}`, name]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--primary)' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Tableau équivalent (accessibilité). */
export function DataTable({
  data,
  unit,
  caption,
}: {
  data: Point[];
  unit: string;
  caption: string;
}) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-muted">Voir les données en tableau</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="border-t border-border">
              <th scope="row" className="py-1 text-left font-normal text-muted">
                {d.label}
              </th>
              <td className="py-1 text-right tabular-nums">
                {d.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
