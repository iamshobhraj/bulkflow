export type Env = {
  DB: D1Database

  // AWS SQS (if you use reminders via SQS)
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  AWS_REGION?: string
  SQS_QUEUE_URL?: string

  // Telegram configuration
  TG_BOT_TOKEN?: string
  TG_WEBHOOK_SECRET?: string

  // Admin
  ADMIN_TOKEN?: string
}
