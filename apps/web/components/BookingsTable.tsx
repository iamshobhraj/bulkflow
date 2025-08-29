import React from "react";
import { Booking } from "../types";
import { fmtLocal } from "../lib/time";

export default function BookingsTable({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border col-span-full">
      <h3 className="text-lg font-semibold mb-2">Recent Bookings</h3>
      {!bookings.length ? (
        <p className="text-sm text-gray-600">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">ID</th>
                <th className="text-left p-2 border-b">Service</th>
                <th className="text-left p-2 border-b">Start</th>
                <th className="text-left p-2 border-b">Status</th>
                <th className="text-left p-2 border-b">Chat</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="odd:bg-gray-50">
                  <td className="p-2 border-b font-mono">{b.id.slice(0,8)}…</td>
                  <td className="p-2 border-b">{b.service}</td>
                  <td className="p-2 border-b">{fmtLocal(b.start_ts)}</td>
                  <td className="p-2 border-b">{b.status}</td>
                  <td className="p-2 border-b">{b.chat_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
