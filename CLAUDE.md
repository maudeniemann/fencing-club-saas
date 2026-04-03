# Fencing Club SaaS — Dynamo Fencing Center

## Stack
- **Framework**: Next.js 16 (App Router, React 19, TypeScript 5)
- **Database**: Supabase (PostgreSQL + RLS + Realtime)
- **Payments**: Stripe + Stripe Connect (multi-tenant payouts, 5% platform fee)
- **Email**: Resend (transactional notifications)
- **Calendar**: Google Calendar API (booking sync)
- **UI**: Tailwind 4 + shadcn/ui + Radix + Recharts + React Hook Form + Zod
- **Data**: TanStack React Query (60s staleTime)
- **Deployment**: Vercel (auto-billing cron: 1st of month, 9AM UTC)
- **Testing**: Playwright 1.58

## Architecture Rules
- All pages are Server Components by default — only add "use client" when necessary
- Auth: Supabase SSR client with cookie-based sessions, refreshed in middleware
- Admin operations: use `createAdminClient()` to bypass RLS — never expose service role key client-side
- API routes: always call `getAuthenticatedMember()` first — returns (user, member, club, adminClient)
- RLS enforces club isolation at DB level via `get_user_club_id()` — defense in depth
- Demo mode: set `demo_role` cookie to admin/coach/player — bypasses auth entirely
- Path alias: `@/*` → `src/*`

## Database (18 tables)
- `clubs` — tenant entity with Stripe Connect + subscription + timezone
- `club_members` — auth.users ↔ clubs join table with roles (admin/coach/player)
- `venues` / `strips` — physical locations with individual fencing strips
- `lesson_types` — private/group/clinic with pricing
- `availability_slots` — recurring + one-off coach availability
- `bookings` — appointments (confirmed/completed/cancelled/no_show/disputed)
- `booking_participants` — group lesson support
- `recurring_bookings` — weekly/biweekly series templates
- `payments` — lesson + cancellation + no-show fees
- `coach_payouts` — aggregated earnings with commission splits
- `disputes` — payment/lesson disputes with resolution flow
- `waitlist_entries` — unified waitlist + new time requests (priority scored)
- `lesson_logs` — post-lesson records (weapons, drills, scores, ratings)
- `conversations` / `conversation_participants` / `messages` — real-time messaging
- `notifications` — in-app + email channels
- `audit_log` — all changes with diffs and actor info

## Key Patterns
- Conflict detection: `hasBookingConflict()` prevents double-booking
- Waitlist priority: scored by proximity to desired time + booking history
- Stripe flow: SetupIntent → ConfirmSetup → PaymentIntent → Webhook
- Notifications: table-driven with type, channel, and JSONB data payload
- Middleware: session refresh → demo detection → route protection → club validation → role check

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_WEBHOOK_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_APP_URL, RESEND_API_KEY, RESEND_FROM_EMAIL, CRON_SECRET
```

## Data Context
- **Club**: Dynamo Fencing Center (ID: da1f8770-aabf-49a2-986c-1e4fb45d2651)
- **Live**: https://fencing-club-saas.vercel.app
- **Data**: 448 members, 12 coaches, 11,846 bookings, 4 venues, 49 availability slots
- **Known limitation**: Pricing at $0 for all lesson types — needs manual admin input at `/admin/lesson-types`

## Dev
```bash
npm run dev      # localhost:3456
npm run build    # production build
npm run lint     # ESLint
```
