-- Booking Bot schema only (no legacy campaigns)

CREATE TABLE IF NOT EXISTS services(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS slots(
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  start_ts TEXT NOT NULL,
  end_ts   TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  booked_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tg_users(
  chat_id   TEXT PRIMARY KEY,
  username  TEXT,
  first_name TEXT,
  last_name  TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings(
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES tg_users(chat_id),
  service_id TEXT NOT NULL REFERENCES services(id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions(
  chat_id TEXT PRIMARY KEY,
  state TEXT,
  ctx TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
