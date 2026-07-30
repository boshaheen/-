import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import type { TraitScore } from '../types'

export default function ScoreRadar({ traits }: { traits: TraitScore[] }) {
  const data = traits.map((t) => ({ subject: t.nameAr, score: t.score, fullMark: 100 }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="rgba(255,255,255,0.15)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#f5f1e8', fontSize: 11 }} />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          />
          <Radar
            name="التقييم"
            dataKey="score"
            stroke="#fbbf24"
            fill="#fbbf24"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
