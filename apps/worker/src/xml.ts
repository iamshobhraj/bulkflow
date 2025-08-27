export function extractMessages(xml: string) {
  const messages: { body: string; receiptHandle: string }[] = []
  const reMsg = /<Message>([\s\S]*?)<\/Message>/g
  let m
  while ((m = reMsg.exec(xml))) {
    const seg = m[1]
    const body = (seg.match(/<Body>([\s\S]*?)<\/Body>/) || [,''])[1]
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    const receiptHandle = (seg.match(/<ReceiptHandle>([\s\S]*?)<\/ReceiptHandle>/) || [,''])[1]
    if (body && receiptHandle) messages.push({ body, receiptHandle })
  }
  return messages
}
