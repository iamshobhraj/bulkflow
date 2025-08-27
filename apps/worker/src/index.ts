import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { sendMessage, receiveMessages, deleteMessage } from './sqs'
import { extractMessages } from './xml'
import type { Env } from './types'

const app = new Hono<{ Bindings: Env }>()
app.use('*', cors())

app.get('/health', c => c.json({ ok: true }))

app.post('/campaigns', async c => {
  const schema = z.object({ name: z.string().min(2), scheduled_at: z.string().datetime().nullable().optional() })
  const data = schema.parse(await c.req.json())
  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO campaigns (id, name, scheduled_at, created_at) VALUES (?1, ?2, ?3, datetime("now"))')
    .bind(id, data.name, data.scheduled_at ?? null).run()
  return c.json({ id, ...data })
})

app.post('/campaigns/:id/enqueue', async c => {
  const id = c.req.param('id')
  const body = await c.req.json<{ recipients: string[] }>()
  const recipients = (body.recipients || []).map(s => s.trim()).filter(Boolean)

  const row = await c.env.DB.prepare('SELECT id FROM campaigns WHERE id = ?1').bind(id).first()
  if (!row) return c.json({ error: 'Campaign not found' }, 404)

  await Promise.all(recipients.map(phone => sendMessage(c.env, JSON.stringify({ campaignId: id, to: phone }))))
  return c.json({ enqueued: recipients.length })
})

app.get('/campaigns/:id/analytics', async c => {
  const id = c.req.param('id')
  const stats = await c.env.DB.prepare(
    'SELECT status, COUNT(*) as count FROM recipients WHERE campaign_id = ?1 GROUP BY status'
  ).bind(id).all()
  return c.json(stats)
})

app.post('/admin/processOnce', async c => {
  const token = c.req.header('x-admin-token') || ''
  if (c.env.ADMIN_TOKEN && token !== c.env.ADMIN_TOKEN) {
    return c.text('unauthorized', 401)
  }
  await processQueue(c.env) // reuse the same function your cron uses
  return c.json({ ok: true })
})

app.get('/admin/debugCreds', c => {
  const ak = c.env.AWS_ACCESS_KEY_ID || ''
  const region = c.env.AWS_REGION || ''
  const url = c.env.SQS_QUEUE_URL || ''
  return c.json({
    accessKeyId_prefix: ak ? ak.slice(0, 4) : null,
    region,
    queueUrl_host: url ? new URL(url).host : null
  })
})


export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(processQueue(env))
  }
}

function htmlUnescape(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeJsonBody(raw: string): string {
  let s = raw.trim();
  // Try to undo common wrappers/encodings
  s = htmlUnescape(s);
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1); // strip wrapping quotes
  try { s = decodeURIComponent(s); } catch { /* not URI encoded */ }
  return s;
}

async function processQueue(env: Env) {
  const xml = await receiveMessages(env, 10, 5)
  const messages = extractMessages(xml)

  for (const m of messages) {
    try {
        const normalized = normalizeJsonBody(m.body);
      const payload = JSON.parse(normalized) as { campaignId: string; to: string }
      const ok = Math.random() > 0.1

      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO recipients (id, campaign_id, phone, status, updated_at) VALUES (?1, ?2, ?3, ?4, datetime("now")) ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = datetime("now")'
        ).bind(`${payload.campaignId}:${payload.to}`, payload.campaignId, payload.to, ok ? 'DELIVERED' : 'FAILED'),
        env.DB.prepare(
          'INSERT INTO delivery_logs (id, campaign_id, recipient_id, status, ts) VALUES (?1, ?2, ?3, ?4, datetime("now"))'
        ).bind(crypto.randomUUID(), payload.campaignId, `${payload.campaignId}:${payload.to}`, ok ? 'DELIVERED' : 'FAILED')
      ])

      await deleteMessage(env, m.receiptHandle)
    } catch (e) {
      console.error('Process error', e)
    }
  }
}
