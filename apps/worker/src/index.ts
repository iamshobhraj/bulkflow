import { Hono } from "hono"
import type { Env } from "./types"
import { sendSqs } from "./sqs" // optional; used for reminders if SQS configured
import { receiveSqs, deleteSqs } from "./sqs";


const app = new Hono<{ Bindings: Env }>()

// CORS (must be before routes)
app.use("*", async (c, next) => {
  // Handle preflight quickly
  if (c.req.method === "OPTIONS") {
    c.header("Access-Control-Allow-Origin", c.req.header("origin") || "*");
    c.header("Access-Control-Allow-Headers", "content-type, x-admin-token");
    c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    c.header("Access-Control-Max-Age", "86400");
    return c.body(null, 204);
  }

  await next();

  // Add CORS to all actual responses
  c.header("Access-Control-Allow-Origin", c.req.header("origin") || "*");
  c.header("Access-Control-Allow-Headers", "content-type, x-admin-token");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
});


/* ---------- Utilities ---------- */
const json = (o: any) => JSON.stringify(o)
// always produce UTC "YYYY-MM-DD HH:MM:SS"
const toUTC = (d: Date) => d.toISOString().slice(0,19).replace("T", " ");


async function requireAdmin(c: any) {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) {
    return c.text("forbidden", 403)
  }
  return null
}

const DISPLAY_TZ = "Asia/Kolkata"; // change if you prefer

function fmtLocal(tsUtc: string, withDate = true) {
  // tsUtc is "YYYY-MM-DD HH:MM:SS" in UTC
  const d = new Date(tsUtc.replace(" ", "T") + "Z");
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TZ,
    ...(withDate ? { dateStyle: "medium" } : {}),
    timeStyle: "short",
    hour12: false,
  });
  return fmt.format(d);
}


/* ---------- Telegram send helper ---------- */
async function tgSend(env: Env, chatId: string, text: string, keyboard?: any) {
  if (!env.TG_BOT_TOKEN) throw new Error("TG_BOT_TOKEN missing")
  const url = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`
  const payload: any = { chat_id: chatId, text }
  if (keyboard) payload.reply_markup = keyboard
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`tg send failed: ${res.status} ${await res.text()}`)
}

/* ---------- DB session helpers ---------- */
async function setState(env: Env, chatId: string, state: string | null, ctx: any | null) {
  if (!state) {
    await env.DB.prepare("DELETE FROM sessions WHERE chat_id=?1").bind(chatId).run()
    return
  }
  await env.DB.prepare(
    "INSERT OR REPLACE INTO sessions(chat_id,state,ctx,updated_at) VALUES(?1,?2,?3,datetime('now'))"
  ).bind(chatId, state, ctx ? json(ctx) : null).run()
}
async function getState(env: Env, chatId: string) {
  return await env.DB.prepare("SELECT state, ctx FROM sessions WHERE chat_id=?1").bind(chatId).first<{state:string,ctx:string}>()
}

/* ---------- Keyboards ---------- */
const kb = {
  services: (items: { id: string; name: string }[]) => ({
    inline_keyboard: items.map(s => [{ text: s.name, callback_data: `svc:${s.id}` }])
  }),
  dates: (dates: string[]) => ({
    inline_keyboard: dates.map(d => [{ text: d, callback_data: `date:${d}` }])
  }),
  slots: (slots: { id: string; label: string }[]) => ({
    inline_keyboard: slots.map(s => [{ text: s.label, callback_data: `slot:${s.id}` }])
  }),
  confirm: (sid: string, sl: string) => ({
    inline_keyboard: [
      [{ text: "✅ Confirm", callback_data: `confirm:${sid}:${sl}` }],
      [{ text: "❌ Cancel", callback_data: "abort" }]
    ]
  })
}

/* ---------- Health ---------- */
app.get("/health", c => c.json({ ok: true }))

/* ---------- Admin endpoints (seed + CRUD) ---------- */
app.post("/admin/seed", async c => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("forbidden", 403)

  await c.env.DB.prepare("INSERT OR IGNORE INTO services(id,name,duration_min,active) VALUES('demo_call','Demo Call',30,1)").run()

  const now = new Date(); now.setMinutes(0, 0, 0)
  for (let i = 1; i <= 6; i++) {
    const start = new Date(now.getTime() + i * 3600_000)
    const end = new Date(start.getTime() + 30 * 60_000)
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO slots(id,service_id,start_ts,end_ts,capacity) VALUES(?1,'demo_call',?2,?3,1)"
    ).bind(crypto.randomUUID(), toUTC(start), toUTC(end)).run()
  }
  return c.json({ ok: true })
})

app.get("/admin/services/list", async c => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("forbidden", 403)
  const rows = await c.env.DB.prepare("SELECT id,name,duration_min,active FROM services ORDER BY name").all()
  return c.json({ results: rows.results || [] })
})
app.post("/admin/services/create", async c => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("forbidden", 403)
  const body = await c.req.json<{ id:string; name:string; duration_min:number; active?:number }>()
  if (!body.id || !body.name || !body.duration_min) return c.text("bad request", 400)
  await c.env.DB.prepare("INSERT OR IGNORE INTO services(id,name,duration_min,active) VALUES(?1,?2,?3,COALESCE(?4,1))")
    .bind(body.id, body.name, body.duration_min, body.active ?? 1).run()
  return c.json({ ok: true })
})

app.get("/admin/slots/list", async c => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("forbidden", 403)
  const serviceId = c.req.query("service")
  const sql = serviceId
    ? "SELECT id,service_id,start_ts,end_ts,capacity,booked_count FROM slots WHERE service_id=?1 ORDER BY start_ts"
    : "SELECT id,service_id,start_ts,end_ts,capacity,booked_count FROM slots ORDER BY start_ts"
  const rows = serviceId ? await c.env.DB.prepare(sql).bind(serviceId).all() : await c.env.DB.prepare(sql).all()
  return c.json({ results: rows.results || [] })
})
app.post("/admin/slots/create", async c => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("forbidden", 403)
  const body = await c.req.json<{ service_id:string; start_ts:string; end_ts:string; capacity:number }>()
  if (!body.service_id || !body.start_ts || !body.end_ts || !body.capacity) return c.text("bad request", 400)
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO slots(id,service_id,start_ts,end_ts,capacity) VALUES(?1,?2,?3,?4,?5)"
  ).bind(crypto.randomUUID(), body.service_id, body.start_ts, body.end_ts, body.capacity).run()
  return c.json({ ok: true })
})

app.get("/admin/bookings/recent", async c => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) return c.text("forbidden", 403)
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.chat_id, b.status, s.name as service, sl.start_ts
     FROM bookings b
     JOIN services s ON s.id=b.service_id
     JOIN slots sl ON sl.id=b.slot_id
     ORDER BY b.created_at DESC LIMIT 50`
  ).all()
  return c.json({ results: rows.results || [] })
})

/* ---------- Telegram webhook (booking flow) ---------- */
app.post("/tg/webhook", async c => {
  if (c.env.TG_WEBHOOK_SECRET && c.req.header("x-telegram-bot-api-secret-token") !== c.env.TG_WEBHOOK_SECRET) {
    return c.text("forbidden", 403)
  }
  const update = await c.req.json()
  const msg = update.message || update.callback_query?.message
  if (!msg?.chat?.id) return c.json({ ok: true })

  const chatId = String(msg.chat.id)
  const from = update.message?.from || update.callback_query?.from

  // upsert user
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO tg_users(chat_id,username,first_name,last_name,created_at) " +
    "VALUES(?1,?2,?3,?4,COALESCE((SELECT created_at FROM tg_users WHERE chat_id=?1), datetime('now')))"
  ).bind(chatId, from?.username ?? null, from?.first_name ?? null, from?.last_name ?? null).run()

  // commands
  if (update.message?.text?.startsWith("/")) {
    const t: string = update.message.text.trim()
    if (t === "/start") {
      await tgSend(c.env, chatId, "Welcome to BulkFlow Booking Bot! Use /book to start.")
      return c.json({ ok: true })
    }
    if (t === "/book") {
      await setState(c.env, chatId, "CHOOSE_SERVICE", {})
      const svcs = await c.env.DB.prepare("SELECT id,name FROM services WHERE active=1").all()
      if (!svcs.results?.length) { await tgSend(c.env, chatId, "No services available right now."); return c.json({ ok: true }) }
      await tgSend(c.env, chatId, "Choose a service:", kb.services(svcs.results as any))
      return c.json({ ok: true })
    }
    if (t === "/mybookings") {
      const rows = await c.env.DB.prepare(
        `SELECT b.id, s.name, sl.start_ts FROM bookings b
         JOIN services s ON s.id=b.service_id
         JOIN slots sl ON sl.id=b.slot_id
         WHERE b.chat_id=?1 AND b.status='CONFIRMED' ORDER BY sl.start_ts`
      ).bind(chatId).all()
      if (!rows.results?.length) await tgSend(c.env, chatId, "You have no active bookings.")
      else {
        const text = (rows.results as any[]).map(r => `• ${r.name} at ${fmtLocal(r.start_ts)} (id: ${r.id})`).join("\n")
        await tgSend(c.env, chatId, text)
      }
      return c.json({ ok: true })
    }
    await tgSend(c.env, chatId, "Unknown command. Try /book")
    return c.json({ ok: true })
  }

  // callback buttons
  if (update.callback_query) {
    const data: string = update.callback_query.data || ""

    if (data.startsWith("svc:")) {
      const serviceId = data.split(":")[1]
      await setState(c.env, chatId, "CHOOSE_DATE", { serviceId })
      const rows = await c.env.DB.prepare(
        `SELECT DISTINCT substr(start_ts,1,10) AS d
         FROM slots WHERE service_id=?1 AND booked_count < capacity AND start_ts > datetime('now')
         ORDER BY d LIMIT 5`
      ).bind(serviceId).all()
      const dates = (rows.results || []).map((r: any) => r.d)
      await tgSend(c.env, chatId, dates.length ? "Pick a date:" : "No dates; try later.", kb.dates(dates))
      return c.json({ ok: true })
    }

    if (data.startsWith("date:")) {
      const date = data.split(":")[1]
      const st = await getState(c.env, chatId)
      const ctx = { ...(st?.ctx ? JSON.parse(st.ctx) : {}), date }
      await setState(c.env, chatId, "CHOOSE_SLOT", ctx)
      const rows = await c.env.DB.prepare(
        `SELECT id, start_ts, end_ts FROM slots
         WHERE service_id=?1 AND booked_count < capacity AND start_ts BETWEEN ?2 AND ?3
         ORDER BY start_ts`
      ).bind(ctx.serviceId, `${date} 00:00:00`, `${date} 23:59:59`).all()
      const slots = (rows.results || []).map((r: any) => ({ id: r.id, label: fmtLocal(r.start_ts, false) }))
      await tgSend(c.env, chatId, slots.length ? "Pick a time:" : "No slots for that date.", kb.slots(slots))
      return c.json({ ok: true })
    }

    if (data.startsWith("slot:")) {
      const slotId = data.split(":")[1]
      const st = await getState(c.env, chatId)
      const ctx = { ...(st?.ctx ? JSON.parse(st.ctx) : {}), slotId }
      await setState(c.env, chatId, "CONFIRM", ctx)
      await tgSend(c.env, chatId, "Confirm your booking?", kb.confirm(ctx.serviceId, slotId))
      return c.json({ ok: true })
    }

    if (data.startsWith("confirm:")) {
      const [, serviceId, slotId] = data.split(":")
      const slot = await c.env.DB.prepare("SELECT capacity, booked_count FROM slots WHERE id=?1").bind(slotId).first<{capacity:number,booked_count:number}>()
      if (!slot) { await tgSend(c.env, chatId, "Slot not found."); return c.json({ ok: true }) }
      if (slot.booked_count >= slot.capacity) { await tgSend(c.env, chatId, "Sorry, slot already full."); return c.json({ ok: true }) }

      const bookingId = crypto.randomUUID()
      await c.env.DB.batch([
        c.env.DB.prepare("INSERT INTO bookings(id,chat_id,service_id,slot_id,status) VALUES(?1,?2,?3,?4,'CONFIRMED')").bind(bookingId, chatId, serviceId, slotId),
        c.env.DB.prepare("UPDATE slots SET booked_count = booked_count + 1 WHERE id=?1").bind(slotId),
        c.env.DB.prepare("DELETE FROM sessions WHERE chat_id=?1").bind(chatId),
      ])

      // enqueue a reminder job if SQS is configured (optional)
      try {
        if (c.env.SQS_QUEUE_URL) await sendSqs(c.env, json({ kind: "REMINDER", bookingId, chatId }))
      } catch (e) {
        // ignore SQS error for demo
        console.error("sqs enqueue error", e)
      }

      await tgSend(c.env, chatId, "🎉 Booked! We’ll remind you before it starts.")
      return c.json({ ok: true })
    }

    if (data === "abort") {
      await setState(c.env, chatId, null, null)
      await tgSend(c.env, chatId, "Cancelled. Use /book to start again.")
      return c.json({ ok: true })
    }
  }

  return c.json({ ok: true })
})

/* ---------- scheduled handler to poll SQS for reminders (optional) ---------- */
/* ---------- SQS Receive XML helpers ---------- */
type SqsMessage = { messageId: string; receiptHandle: string; body: string };

function parseReceiveXml(xml: string): SqsMessage[] {
  const list: SqsMessage[] = [];
  const parts = xml.split("<Message>").slice(1);
  for (const p of parts) {
    const mid = pick(p, "MessageId");
    const rh = pick(p, "ReceiptHandle");
    const body = unescapeXml(pick(p, "Body") || "{}");
    if (mid && rh) list.push({ messageId: mid, receiptHandle: rh, body });
  }
  return list;
}
const pick = (s: string, tag: string) => {
  const a = s.indexOf(`<${tag}>`); if (a < 0) return "";
  const b = s.indexOf(`</${tag}>`, a); if (b < 0) return "";
  return s.substring(a + tag.length + 2, b);
};
const unescapeXml = (s: string) =>
  s.replaceAll("&quot;", "\"").replaceAll("&apos;", "'")
   .replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");

/* ---------- Processor: poll SQS once and handle reminders ---------- */
async function processQueue(env: Env) {
  // If SQS isn't configured, just exit quietly.
  if (!env.SQS_QUEUE_URL) return;

  const xml = await receiveSqs(env, 10, 10); // up to 10 messages, long-poll 10s
  const msgs = parseReceiveXml(xml);

  for (const m of msgs) {
    let deleteIt = true; // set to false to let visibility timeout retry
    try {
      const payload = JSON.parse(m.body) as any;

      if (payload.kind === "REMINDER") {
        // Look up booking start time
        const row = await env.DB.prepare(
          `SELECT sl.start_ts FROM bookings b
             JOIN slots sl ON sl.id = b.slot_id
           WHERE b.id = ?1 AND b.status = 'CONFIRMED'`
        ).bind(payload.bookingId).first<{ start_ts: string }>();

        if (row?.start_ts) {
          const start = new Date(row.start_ts.replace(" ", "T") + "Z");
          const mins = (start.getTime() - Date.now()) / 60000;

          if (mins <= 60 && mins > 0) {
            // Send reminder ~1 hour before
            await tgSend(env, String(payload.chatId), "⏰ Reminder: your booking starts in ~1 hour.");
            // deleteIt = true (default) so we won't see this message again
          } else {
            // Not due yet → keep message for retry (let visibility timeout expire)
            deleteIt = false;
          }
        } else {
          // No booking found → delete to avoid poison looping
          deleteIt = true;
        }
      } else {
        // Unknown message kind → delete
        deleteIt = true;
      }
    } catch (err) {
      // Parse/processing error → let it retry (or consider DLQ in production)
      console.error("processQueue error:", err);
      deleteIt = false;
    } finally {
      if (deleteIt) {
        try { await deleteSqs(env, m.receiptHandle); } catch (e) { console.error("deleteSqs error:", e); }
      }
    }
  }
}


/* ---------- Admin: processOnce ---------- */
app.post("/admin/processOnce", async (c) => {
  if (c.env.ADMIN_TOKEN && c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) {
    return c.text("forbidden", 403);
  }
  try {
    await processQueue(c.env);
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e?.message || e) }, 500);
  }
});


export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) => {
    await processQueue(env)
  }
}
