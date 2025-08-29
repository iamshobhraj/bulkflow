import React, { useState } from "react";
import { api } from "../lib/api";

export default function ServiceForm({ onDone, onSelect }:{
  onDone: () => void; onSelect: (id: string)=>void;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim() || !name.trim()) return setMsg("Fill all service fields.");
    try {
      await api.post("/admin/services/create", {
        id: id.trim(), name: name.trim(), duration_min: duration, active: active ? 1 : 0
      });
      setMsg("Service created ✅");
      onSelect(id.trim());
      setId(""); setName(""); setDuration(30); setActive(true);
      await onDone();
    } catch (e:any) { setMsg("Create service failed"); }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 border">
      <h3 className="text-lg font-semibold mb-2">Create Service</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="text-sm text-gray-600">Service ID (slug)</label>
            <input className="w-full border rounded-md px-3 py-2" placeholder="demo_call"
                   value={id} onChange={e=>setId(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-gray-600">Name</label>
            <input className="w-full border rounded-md px-3 py-2" placeholder="Demo Call"
                   value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div className="w-36">
            <label className="text-sm text-gray-600">Duration (min)</label>
            <input type="number" className="w-full border rounded-md px-3 py-2"
                   value={duration} onChange={e=>setDuration(Number(e.target.value))}/>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
            <span>Active</span>
          </label>
        </div>
        <button type="submit" className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700">
          Create Service
        </button>
      </form>
      {msg && <p className="text-sm mt-2 text-gray-700">{msg}</p>}
    </div>
  );
}
