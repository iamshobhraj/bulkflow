export async function signAwsRequest(opts: {
  method: string
  url: string
  headers: Record<string, string>
  body: string
  region: string
  service: string
  accessKeyId: string
  secretAccessKey: string
}) {
  const { method, url, headers, body, region, service, accessKeyId, secretAccessKey } = opts
  const u = new URL(url)

  const amzDate = headers["x-amz-date"] || new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  headers["x-amz-date"] = amzDate
  headers["host"] = headers["host"] || u.host

  const signedHeaders = Object.keys(headers)
    .map(h => h.toLowerCase())
    .sort()
    .join(";")

  const canonicalHeaders = Object.keys(headers)
    .map(h => h.toLowerCase())
    .sort()
    .map(h => `${h}:${headers[h]}\n`)
    .join("")

  const hashHex = await sha256Hex(body)
  const canonicalRequest = [
    method.toUpperCase(),
    u.pathname || "/",
    u.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    hashHex
  ].join("\n")

  const date = amzDate.slice(0, 8)
  const scope = `${date}/${region}/${service}/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n")

  const kDate = await hmac(`AWS4${secretAccessKey}`, date)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, "aws4_request")
  const signature = await hmacHex(kSigning, stringToSign)

  headers["authorization"] =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return { headers }
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", enc)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("")
}
async function hmac(key: string | ArrayBuffer, data: string) {
  const k = typeof key === "string" ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data))
}
async function hmacHex(key: ArrayBuffer, data: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("")
}
