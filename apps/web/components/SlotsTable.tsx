import React, { useMemo } from "react";
import { Slot } from "../types";
import { fmtLocal, parseUtc } from "../lib/time";

export default function SlotsTable({ slots }: { slots: Slot[] }) {
  const future = useMemo(() => {
    const now = Date.now();
    const grace = 2 * 60 * 1000;
    return (slots || []).filter(s => parseUtc(s.start_ts) > (now + grace));
  }, [slots]);

  return (
    <div className="bg-white rounded-xl shadow p-4 border col-span-full">
      <h3 className="text-lg font-semibold mb-2">Future Slots (Available)</h3>
      {!future.length ? (
        <p className="text-sm text-gray-600">No upcoming available slots.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Service</th>
                <th className="text-left p-2 border-b">Start</th>
                <th className="text-left p-2 border-b">End</th>
                <th className="text-left p-2 border-b">Cap</th>
                <th className="text-left p-2 border-b">Booked</th>
              </tr>
            </thead>
            <tbody>
              {future.map(s => (
                <tr key={s.id} className="odd:bg-gray-50">
                  <td className="p-2 border-b">{s.service_id}</td>
                  <td className="p-2 border-b">{fmtLocal(s.start_ts)}</td>
                  <td className="p-2 border-b">{fmtLocal(s.end_ts)}</td>
                  <td className="p-2 border-b">{s.capacity}</td>
                  <td className="p-2 border-b">{s.booked_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
