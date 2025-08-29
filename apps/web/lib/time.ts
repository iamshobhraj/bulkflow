export const DISPLAY_TZ = "Asia/Kolkata"; // change if needed

export function toUtcString(d: Date) {
  return d.toISOString().slice(0, 19).replace("T", " "); // "YYYY-MM-DD HH:MM:SS" UTC
}
export function parseUtc(tsUtc: string) {
  return new Date(tsUtc.replace(" ", "T") + "Z").getTime();
}
export function fmtLocal(tsUtc: string, withDate = true) {
  const d = new Date(tsUtc.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TZ,
    ...(withDate ? { dateStyle: "medium" } : {}),
    timeStyle: "short",
    hour12: false,
  }).format(d);
}
