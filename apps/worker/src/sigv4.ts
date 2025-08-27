// Minimal AWS SigV4 signing for SQS
export async function awsSignedFetch(
  url: string,
  { method = 'POST', body = '', region, service = 'sqs', accessKeyId, secretAccessKey }:
  { method?: string; body?: string; region: string; service?: string; accessKeyId: string; secretAccessKey: string }
) {
  const { crypto } = globalThis as any
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const host = new URL(url).host

  const contentType = 'application/x-www-form-urlencoded; charset=utf-8'
  const signedHeaders = 'content-type;host;x-amz-date'
  const canonicalRequest = [
    method,
    new URL(url).pathname,
    new URL(url).searchParams.toString(),
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    '',
    signedHeaders,
    await sha256Hex(body)
  ].join('\n')

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n')

  const kDate = await hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = await hmacHex(kSigning, stringToSign)

  const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return fetch(url, {
    method,
    headers: {
      'Content-Type': contentType,
      'X-Amz-Date': amzDate,
      'Authorization': authHeader
    },
    body
  })

  async function sha256Hex(data: string) {
    const enc = new TextEncoder()
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(data))
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  async function hmac(key: string | ArrayBuffer, data: string) {
    const enc = new TextEncoder()
    const k = await crypto.subtle.importKey(
      'raw',
      typeof key === 'string' ? enc.encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data))
    return sig
  }
  async function hmacHex(key: ArrayBuffer, data: string) {
    const sig = await hmac(key, data)
    return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
}
