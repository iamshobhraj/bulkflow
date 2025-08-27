import { useState } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_BASE!

export default function Home() {
  const [name, setName] = useState('Demo Campaign')
  const [phones, setPhones] = useState('+919999999999, +918888888888, +917777777777')
  const [campaignId, setCampaignId] = useState('')
  const [stats, setStats] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  async function createCampaign() {
    setBusy(true)
    try {
      const res = await axios.post(`${API}/campaigns`, { name })
      setCampaignId(res.data.id)
    } finally { setBusy(false) }
  }

  async function enqueue() {
    if (!campaignId) return alert('Create a campaign first')
    setBusy(true)
    try {
      const recipients = phones.split(',').map(s => s.trim()).filter(Boolean)
      await axios.post(`${API}/campaigns/${campaignId}/enqueue`, { recipients })
      alert(`Enqueued ${recipients.length} recipients`)
    } finally { setBusy(false) }
  }

  async function refresh() {
    if (!campaignId) return
    const res = await axios.get(`${API}/campaigns/${campaignId}/analytics`)
    setStats(res.data.results || res.data)
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'Inter, system-ui' }}>
      <h1>BulkFlow — Campaign & Analytics</h1>

      <section style={{ marginTop: 24 }}>
        <h3>Create Campaign</h3>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Campaign name" style={{ width:'100%', padding:8 }} />
        <button disabled={busy} onClick={createCampaign} style={{ marginTop: 8, padding: 8 }}>Create</button>
        {campaignId && <p>Campaign ID: <code>{campaignId}</code></p>}
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Recipients</h3>
        <textarea value={phones} onChange={e=>setPhones(e.target.value)} rows={4} style={{ width:'100%', padding:8 }} />
        <button disabled={busy} onClick={enqueue} style={{ marginTop: 8, padding: 8 }}>Enqueue</button>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Analytics</h3>
        <button onClick={refresh} style={{ padding: 8 }}>Refresh</button>
        <ul>
          {Array.isArray(stats) && stats.map((row:any) => (
            <li key={row.status}>{row.status}: {row.count}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
