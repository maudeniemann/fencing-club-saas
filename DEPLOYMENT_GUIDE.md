# Fencing Club Management System - Deployment Guide

## Overview

This guide covers the deployment of all new features added to the Fencing Club Management System:

1. ✅ Unified Lesson Request System (waitlist + new time requests)
2. ✅ Built-in Messaging System (booking threads + general DMs)
3. ✅ Favorite Coach Feature
4. ✅ Coach Availability Viewing
5. ✅ Auto-billing System
6. ✅ Parent Role Removal
7. ✅ Progress Page Removal

## Prerequisites

- Node.js 18+ installed
- Supabase project set up
- Stripe account configured
- Vercel account (for deployment)
- Resend account (for email notifications)

## Database Migrations

Run these migrations in order on your Supabase database:

### 1. Migration 00008: Messaging Tables
```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/00008_create_messaging_tables.sql
```

Creates:
- `conversations` table
- `conversation_participants` table
- `messages` table
- RLS policies for security
- Trigger for updating conversation timestamps

### 2. Migration 00009: Enhanced Waitlist
```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/00009_enhance_waitlist_for_lesson_requests.sql
```

Adds:
- `is_new_time_request` column to `waitlist_entries`
- `request_notes` column to `waitlist_entries`

### 3. Migration 00010: Favorite Coach & Auto-billing
```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/00010_add_favorite_coach_and_autobill.sql
```

Adds:
- `favorite_coach_id` column to `club_members`
- `auto_billing_enabled` column to `club_members`

### 4. Migration 00011: Enhanced Notifications
```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/00011_enhance_notifications.sql
```

Adds:
- `sms_sent_at` column to `notifications`
- `email_sent_at` column to `notifications`
- `related_conversation_id` column to `notifications`

### 5. Migration 00012: Remove Parent Role
```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/00012_remove_parent_role.sql
```

⚠️ **IMPORTANT**: This migration:
- Converts all parent accounts to player accounts
- Drops the `parent_child_links` table
- Updates role constraints

**Backup your database before running this migration!**

## Environment Variables

Add these to your `.env.local` (local) and Vercel environment variables (production):

### New Variables Required

```bash
# Cron Jobs (REQUIRED for auto-billing)
CRON_SECRET=your_random_secret_string_here

# Email (REQUIRED for email notifications)
RESEND_FROM_EMAIL=notifications@yourclub.com
```

### Existing Variables (verify they're set)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# App
NEXT_PUBLIC_APP_URL=https://yourclub.com

# Email (Resend)
RESEND_API_KEY=re_xxx
```

## Vercel Cron Job Configuration

The `vercel.json` file configures a monthly cron job for auto-billing:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-billing",
      "schedule": "0 9 1 * *"
    }
  ]
}
```

**Schedule**: Runs on the 1st of every month at 9:00 AM UTC

### Setting Up Cron Secret

1. Generate a secure random string:
   ```bash
   openssl rand -base64 32
   ```

2. Add to Vercel environment variables:
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Add `CRON_SECRET` with the generated value

3. The cron endpoint is protected - only requests with the correct secret can execute it

## Deployment Steps

### 1. Run Database Migrations

```bash
# Connect to your Supabase database
cd fencing-club-saas

# Run migrations in order
npm run supabase migration up
# Or run each SQL file manually via Supabase dashboard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build and Test Locally

```bash
# Set up .env.local with all required variables
cp .env.local.example .env.local
# Edit .env.local with your values

# Run development server
npm run dev

# Test key features:
# - Login as coach and view lesson requests page
# - Login as player and send a message
# - Set favorite coach as player
# - View coach availability
# - Enable auto-billing (requires payment method)
```

### 4. Deploy to Vercel

```bash
# Push to your git repository
git add .
git commit -m "Add messaging, lesson requests, and auto-billing features"
git push origin main

# Vercel will auto-deploy if connected
# Or manually deploy:
vercel --prod
```

### 5. Configure Vercel Environment Variables

In Vercel dashboard, add:
- `CRON_SECRET`
- `RESEND_FROM_EMAIL`
- All other required environment variables

### 6. Verify Deployment

Test these features in production:

1. **Lesson Requests**: Coach can view unified waitlist + new time requests
2. **Messaging**: Send messages between coaches and players
3. **Favorite Coach**: Players can star a coach
4. **Coach Availability**: View coach's weekly schedule
5. **Auto-billing**: Players can enable/disable monthly billing
6. **Cron Job**: Check Vercel logs on the 1st of the month

## New API Endpoints

### Lesson Requests
- `GET /api/coaches/lesson-requests` - Get all requests for coach
- `POST /api/waitlist` - Create waitlist/lesson request (updated)
- `POST /api/waitlist/[id]/approve` - Approve request
- `POST /api/waitlist/[id]/reject` - Decline request

### Messaging
- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Create/get conversation
- `GET /api/conversations/[id]/messages` - Get messages
- `POST /api/conversations/[id]/messages` - Send message
- `POST /api/conversations/[id]/read` - Mark as read

### Coach Features
- `GET /api/coaches/[id]/availability` - Get coach availability
- `PUT /api/members/favorite-coach` - Set favorite coach

### Auto-billing
- `PUT /api/members/auto-billing` - Toggle auto-billing
- `POST /api/cron/auto-billing` - Cron job (protected)

## New UI Pages

### For Coaches
- `/lesson-requests` - Unified waitlist and new time requests with tabs

### For Players
- `/messages` - Inbox and conversation threads
- `/coaches` - Updated with "View Availability" and "Favorite" buttons
- `/coaches/[id]/availability` - Weekly availability calendar

### For All Users
- `/account` - Updated with auto-billing toggle (players only)

## Feature Testing Checklist

### Lesson Request System
- [ ] Coach sees unified list of waitlist + new time requests
- [ ] Tabs work: All, Waitlist, New Time Requests
- [ ] Coach can approve regular waitlist entry (notifies athlete)
- [ ] Coach can approve new time request (marks as accepted)
- [ ] Coach can decline with reason
- [ ] Athlete receives notifications

### Messaging System
- [ ] Create general DM conversation between coach and player
- [ ] Create booking-specific thread
- [ ] Send and receive messages in real-time
- [ ] Unread count displays correctly
- [ ] Mark as read updates properly
- [ ] Notifications sent for new messages

### Favorite Coach
- [ ] Player can set favorite coach (star icon)
- [ ] Player can unset favorite coach
- [ ] Only coaches can be favorited
- [ ] Non-players cannot set favorites

### Coach Availability
- [ ] View list of all coaches
- [ ] Click "View Availability" shows weekly calendar
- [ ] Available slots show in green
- [ ] Booked slots show as gray
- [ ] Week navigation works (prev/next/current)

### Auto-billing
- [ ] Toggle only visible to players
- [ ] Cannot enable without payment method
- [ ] Warning shows if no payment method
- [ ] Toggle persists after page refresh
- [ ] Cron job runs successfully on schedule
- [ ] Notifications sent after billing

### Parent Role Removal
- [ ] Former parents can login as players
- [ ] No "Manage Children" option in dropdown
- [ ] Progress page returns 404
- [ ] Booking API prevents booking for others

## Troubleshooting

### Migrations Fail
- **Issue**: Migration errors
- **Solution**: Check if tables already exist, run migrations in correct order

### Cron Job Not Running
- **Issue**: Auto-billing doesn't execute
- **Solution**:
  - Verify `CRON_SECRET` is set in Vercel
  - Check Vercel cron logs
  - Ensure `vercel.json` is deployed

### Messages Not Real-time
- **Issue**: Messages don't appear instantly
- **Solution**:
  - Check Supabase Realtime is enabled
  - Verify postgres_changes subscription
  - Fallback to polling (5-second interval)

### Email Notifications Not Sending
- **Issue**: No email notifications
- **Solution**:
  - Verify `RESEND_API_KEY` is valid
  - Check `RESEND_FROM_EMAIL` is configured
  - Verify domain in Resend dashboard

### Favorite Coach Not Saving
- **Issue**: Favorite coach doesn't persist
- **Solution**:
  - Check database migration 00010 ran successfully
  - Verify RLS policies allow updates
  - Check browser console for errors

## Rollback Plan

If you need to rollback:

### 1. Revert Code Changes
```bash
git revert HEAD
git push origin main
```

### 2. Restore Parent Role (if needed)
```sql
-- Add parent back to role enum
ALTER TABLE club_members DROP CONSTRAINT club_members_role_check;
ALTER TABLE club_members ADD CONSTRAINT club_members_role_check
  CHECK (role IN ('admin', 'coach', 'player', 'parent'));

-- Recreate parent_child_links table (structure from backup)
```

### 3. Remove New Tables (if critical issues)
```sql
-- Only if absolutely necessary
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
```

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Check Supabase database logs
3. Review browser console errors
4. Check Stripe dashboard for payment issues

## Success Metrics

Track these metrics to measure success:

- ✅ Zero data loss during parent role migration
- ✅ Message delivery success rate > 99%
- ✅ Auto-billing success rate > 95%
- ✅ Page load times remain under 2 seconds
- ✅ Zero regression in existing features

## Next Steps

After successful deployment:

1. Monitor error logs for 48 hours
2. Gather user feedback on new features
3. Fine-tune notification settings based on usage
4. Consider adding SMS notifications (Twilio integration ready)
5. Plan for mobile app with same features

---

**Deployment Date**: ____________

**Deployed By**: ____________

**Status**: ____________
