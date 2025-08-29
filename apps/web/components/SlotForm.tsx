import React, { useState } from "react";
import { api } from "../lib/api";
import { toUtcString } from "../lib/time";

export default function SlotForm({ serviceId, onCreated }:{
  serviceId: string; onCreated: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [capacity, setCapacity] = useState(1);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !date || !time) return setMsg("Fill all slot fields.");
    const localStart = new Date(`${date}T${time}:00`);
    const start_ts = toUtcString(localStart);
    const end_ts = toUtcString(new Date(localStart.getTime() + duration * 60_000));
    try {
      await api.post("/admin/slots/create", { service_id: serviceId, start_ts, end_ts, capacity });
      setMsg("Slot created ✅");
      setTime(""); setCapacity(1);
      await onCreated();
    } catch (e:any) { setMsg("Create slot failed"); }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 border">
      <h3 className="text-lg font-semibold mb-2">Create Slot</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="text-sm text-gray-600">Date</label>
            <input type="date" className="w-full border rounded-md px-3 py-2" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div className="w-36">
            <label className="text-sm text-gray-600">Start (local)</label>
            <input type="time" className="w-full border rounded-md px-3 py-2" value={time} onChange={e=>setTime(e.target.value)} />
          </div>
          <div className="w-36">
            <label className="text-sm text-gray-600">Duration (min)</label>
            <input type="number" className="w-full border rounded-md px-3 py-2" value={duration} onChange={e=>setDuration(Number(e.target.value))}/>
          </div>
          <div className="w-36">
            <label className="text-sm text-gray-600">Capacity</label>
            <input type="number" className="w-full border rounded-md px-3 py-2" min={1} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/>
          </div>
        </div>
        <button type="submit" disabled={!serviceId} className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700">
          Create
        </button>
      </form>
      {msg && <p className="text-sm mt-2 text-gray-700">{msg}</p>}
    </div>
  );
}
