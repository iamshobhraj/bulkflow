import React, { useEffect, useState } from "react";
import { getToken, setToken } from "../lib/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [token, setTok] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setTok(getToken()); }, []);

  function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return setMsg("Enter ADMIN_TOKEN");
    setToken(tokenInput.trim());
    setTok(tokenInput.trim());
    setTokenInput("");
    setMsg("");
  }
  function onLogout() { setToken(null); setTok(null); }

  if (!token) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-6 border">
          <h2 className="text-xl font-semibold mb-4">BulkFlow Admin</h2>
          <form onSubmit={onLogin} className="space-y-3">
            <label className="text-sm text-gray-600">Admin Token</label>
            <div className="flex gap-2">
              <input
                type={show ? "text" : "password"}
                placeholder="ADMIN_TOKEN"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              />
              <button type="button" onClick={() => setShow(s=>!s)} className="border rounded-md px-3 py-2 hover:bg-gray-50">
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <button type="submit" className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700">
              Login
            </button>
          </form>
          {msg && <p className="mt-3 text-sm bg-yellow-50 border border-yellow-300 rounded p-2">{msg}</p>}
          <p className="text-xs text-gray-500 mt-3">
            Stored only in your browser (localStorage). Sent as <code>x-admin-token</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold">BulkFlow Admin</div>
        <button onClick={onLogout} className="bg-red-600 text-white rounded-md px-3 py-2 hover:bg-red-700">
          Logout
        </button>
      </div>
      {children}
    </div>
  );
}
