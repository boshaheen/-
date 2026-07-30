import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import analyzeRouter from './routes/analyze.js'
import emailRouter from './routes/email.js'

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 8787

app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
app.use(express.json({ limit: '25mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/analyze', analyzeRouter)
app.use('/api/report/email', emailRouter)

app.listen(port, () => {
  console.log(`camel-rating server listening on http://localhost:${port}`)
})
