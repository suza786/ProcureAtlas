'use client'

// This is the only runtime Recharts import. Entire chart trees live here so
// Recharts sees its native series children rather than lazy wrapper children.
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from 'recharts'

const tooltipStyle = { borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }
export interface BarChartPanelProps {
  data: object[]
  xKey: string
  series: Array<{ key: string; label: string; color: string }>
  tickSize?: number
  margin?: { top: number; right: number; bottom: number; left: number }
  valueFormatter?: (value: number) => string
}
export function BarChartPanel({ data, xKey, series, tickSize = 11, margin, valueFormatter }: BarChartPanelProps) {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={margin} accessibilityLayer>
      <XAxis dataKey={xKey} tick={{ fontSize: tickSize }} stroke="#64748b" />
      <YAxis tick={{ fontSize: tickSize }} stroke="#64748b" />
      <Tooltip contentStyle={tooltipStyle} formatter={valueFormatter ? value => valueFormatter(Number(value)) : undefined} />
      {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} radius={[4, 4, 0, 0]} />)}
    </BarChart>
  </ResponsiveContainer>
}

export interface DonutChartPanelProps {
  data: Array<{ name: string; value: number; fill?: string }>
  colors?: string[]
  outerRadius?: number
  innerRadius?: number
  legendSize?: number
  valueFormatter?: (value: number) => string
  valueLabel?: string
}
export function DonutChartPanel({ data, colors = [], outerRadius = 80, innerRadius = 40, legendSize = 11, valueFormatter, valueLabel }: DonutChartPanelProps) {
  return <ResponsiveContainer width="100%" height="100%">
    <PieChart accessibilityLayer>
      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={outerRadius} innerRadius={innerRadius} paddingAngle={2}>
        {data.map((entry, index) => <Cell key={index} fill={entry.fill ?? colors[index % colors.length] ?? '#0f172a'} />)}
      </Pie>
      <Tooltip contentStyle={tooltipStyle} formatter={valueFormatter ? value => [valueFormatter(Number(value)), valueLabel ?? ''] : undefined} />
      <Legend wrapperStyle={{ fontSize: `${legendSize}px`, paddingTop: '8px' }} />
    </PieChart>
  </ResponsiveContainer>
}

export interface LineChartPanelProps {
  rows: Array<{ date: string }>
  series: Array<{ key: string; label: string; color: string }>
  percent?: boolean
  dateLabel: (date: string) => string
  number: (value: number) => string
}
export function LineChartPanel({ rows, series, percent = false, dateLabel, number }: LineChartPanelProps) {
  return <ResponsiveContainer width="100%" height="100%">
    <LineChart data={rows} accessibilityLayer>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fontSize: 11 }} minTickGap={30} />
      <YAxis tick={{ fontSize: 11 }} tickFormatter={number} domain={percent ? [0, 100] : ['auto', 'auto']} />
      <Tooltip labelFormatter={value => dateLabel(String(value))} formatter={value => number(Number(value))} />
      <Legend />
      {series.map(item => <Line key={item.key} type="linear" dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={2} dot={rows.length < 8} />)}
    </LineChart>
  </ResponsiveContainer>
}
