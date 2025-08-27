import { awsSignedFetch } from './sigv4'
import type { Env } from './types'


async function errorText(res: Response){
    try{ return await res.text()} catch { return `<no-body> status=${res.status}` }
}

export async function sendMessage(env: Env, messageBody: string) {
  const body = new URLSearchParams({
    Action: 'SendMessage',
    Version: '2012-11-05',
    MessageBody: messageBody
  }).toString()
  const res = await awsSignedFetch(env.SQS_QUEUE_URL, {
    method: 'POST', body,
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  })
  if (!res.ok) throw new Error(`SQS SendMessage failed: ${res.status} ${await errorText(res)}`)
  return res.text()
}

export async function receiveMessages(env: Env, max = 10, waitSeconds = 5) {
  const body = new URLSearchParams({
    Action: 'ReceiveMessage',
    Version: '2012-11-05',
    MaxNumberOfMessages: String(max),
    WaitTimeSeconds: String(waitSeconds),
    VisibilityTimeout: '30'
  }).toString()
  const res = await awsSignedFetch(env.SQS_QUEUE_URL, {
    method: 'POST', body,
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  })
  if (!res.ok) throw new Error(`SQS ReceiveMessage failed: ${res.status} ${await errorText(res)}`)
  return res.text()
}

export async function deleteMessage(env: Env, receiptHandle: string) {
  const body = new URLSearchParams({
    Action: 'DeleteMessage',
    Version: '2012-11-05',
    ReceiptHandle: receiptHandle
  }).toString()
  const res = await awsSignedFetch(env.SQS_QUEUE_URL, {
    method: 'POST', body,
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  })
  if (!res.ok) throw new Error(`SQS DeleteMessage failed: ${res.status} ${await errorText(res)}`)
}
