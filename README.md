# BulkFlow – Serverless Booking & Notification Platform

BulkFlow is a *serverless booking system* where users can reserve time slots directly through a *Telegram chatbot*.  
It is powered by *Cloudflare Workers + D1* for backend and persistence, *AWS SQS* for reliable event-driven reminders, and a *Next.js admin dashboard* deployed on *Cloudflare Pages*.

---

## ✨ Features
- 📱 *Telegram Bot Interface* – /book to browse services, view available slots, and confirm bookings.
- ⚡ *Serverless Backend* – Built on Cloudflare Workers with D1 (SQLite) for persistence.
- ⏰ *Event-Driven Reminders* – Bookings enqueue reminder jobs in AWS SQS; Workers poll every 5 minutes.
- 🛠 *Admin Dashboard* – Next.js frontend to create services, add slots, and view bookings.
- 🌍 *End-to-End UTC Handling* – All times stored in UTC, displayed in local timezones.
- 🔒 *Secure* – Admin routes protected with token-based authentication.

---

## 🏗 Architecture

```mermaid
flowchart LR
    TG[Telegram User] --> BOT[Telegram Bot API]
    BOT --> W[Cloudflare Worker API]
    W --> D1[Cloudflare D1 Database]
    W -->|Enqueue reminder| SQS[AWS SQS Queue]
    SQS --> CRON[Cron Worker]
    CRON --> BOT
    Admin[Admin UI] --> W
