import { signAwsRequest } from "./sigv4"
import type { Env } from "./types"

/** SendMessage */
export async function sendSqs(env: Env, body: string) {
  requireSqs(env)
  const host = new URL(env.SQS_QUEUE_URL!).host
  const url = `https://${host}/`
  const params = new URLSearchParams()
  params.set("Action", "SendMessage")
  params.set("QueueUrl", env.SQS_QUEUE_URL!)
  params.set("MessageBody", body)
  params.set("Version", "2012-11-05")

  const headers: Record<string, string> = baseHeaders(host)
  const { headers: signed } = await signAwsRequest({
    method: "POST", url, headers, body: params.toString(),
    region: env.AWS_REGION!, service: "sqs",
    accessKeyId: env.AWS_ACCESS_KEY_ID!, secretAccessKey: env.AWS_SECRET_ACCESS_KEY!
  })

  const res = await fetch(url, { method: "POST", headers: signed, body: params.toString() })
  if (!res.ok) throw new Error(`SQS SendMessage failed: ${res.status} ${await res.text()}`)
  return await res.text()
}

/** ReceiveMessage */
export async function receiveSqs(env: Env, max = 10, wait = 10) {
  requireSqs(env)
  const host = new URL(env.SQS_QUEUE_URL!).host
  const url = `https://${host}/`
  const params = new URLSearchParams()
  params.set("Action", "ReceiveMessage")
  params.set("QueueUrl", env.SQS_QUEUE_URL!)
  params.set("MaxNumberOfMessages", String(Math.min(10, Math.max(1, max))))
  params.set("WaitTimeSeconds", String(Math.min(20, Math.max(0, wait))))
  params.set("VisibilityTimeout", "30")
  params.set("Version", "2012-11-05")

  const headers: Record<string, string> = baseHeaders(host)
  const { headers: signed } = await signAwsRequest({
    method: "POST", url, headers, body: params.toString(),
    region: env.AWS_REGION!, service: "sqs",
    accessKeyId: env.AWS_ACCESS_KEY_ID!, secretAccessKey: env.AWS_SECRET_ACCESS_KEY!
  })

  const res = await fetch(url, { method: "POST", headers: signed, body: params.toString() })
  if (!res.ok) throw new Error(`SQS ReceiveMessage failed: ${res.status} ${await res.text()}`)
  return await res.text()
}

/** DeleteMessage */
export async function deleteSqs(env: Env, receiptHandle: string) {
  requireSqs(env)
  const host = new URL(env.SQS_QUEUE_URL!).host
  const url = `https://${host}/`
  const params = new URLSearchParams()
  params.set("Action", "DeleteMessage")
  params.set("QueueUrl", env.SQS_QUEUE_URL!)
  params.set("ReceiptHandle", receiptHandle)
  params.set("Version", "2012-11-05")

  const headers: Record<string, string> = baseHeaders(host)
  const { headers: signed } = await signAwsRequest({
    method: "POST", url, headers, body: params.toString(),
    region: env.AWS_REGION!, service: "sqs",
    accessKeyId: env.AWS_ACCESS_KEY_ID!, secretAccessKey: env.AWS_SECRET_ACCESS_KEY!
  })

  const res = await fetch(url, { method: "POST", headers: signed, body: params.toString() })
  if (!res.ok) throw new Error(`SQS DeleteMessage failed: ${res.status} ${await res.text()}`)
  return await res.text()
}

/* ---------- helpers ---------- */
function baseHeaders(host: string): Record<string, string> {
  return {
    "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    "host": host,
    "x-amz-date": new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  }
}
function requireSqs(env: Env) {
  if (!env.SQS_QUEUE_URL || !env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("SQS is not configured (set SQS_QUEUE_URL, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)")
  }
}
