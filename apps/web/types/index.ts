export type Service = { id: string; name: string; duration_min: number; active: number };
export type Slot = { id: string; service_id: string; start_ts: string; end_ts: string; capacity: number; booked_count: number };
export type Booking = { id: string; chat_id: string; status: string; service: string; start_ts: string };
