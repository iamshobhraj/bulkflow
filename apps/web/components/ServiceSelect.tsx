import React from "react";
import { Service } from "../types";

export default function ServiceSelect({ services, selected, onChange }:{
  services: Service[]; selected: string; onChange: (id: string)=>void;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border">
      <h3 className="text-lg font-semibold mb-2">Services</h3>
      {!services.length && <p className="text-sm text-gray-600">No services yet.</p>}
      {!!services.length && (
        <select className="w-full border rounded-md px-3 py-2" value={selected} onChange={(e)=>onChange(e.target.value)}>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <p className="text-xs text-gray-500 mt-2">Use “Create Service” to add more.</p>
    </div>
  );
}
