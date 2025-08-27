export type Env = {
  DB: D1Database
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  AWS_REGION: string
  SQS_QUEUE_URL: string
  ADMIN_TOKEN?: string
}
