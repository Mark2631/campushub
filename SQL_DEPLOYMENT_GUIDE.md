# Admin Power Upgrade - SQL Deployment Guide

## ⚠️ Important: Read This First

Before running the SQL migrations:
1. **Backup your database** - This adds new tables and columns
2. **Test in staging** - Run in a test environment first
3. **Review the SQL** - Check `supabase/admin-power-upgrade.sql` for all changes

## 📋 What the SQL Does

### Creates 2 New Tables
- `admin_actions` - Audit trail for all admin operations
- `admin_notices` - System notifications to users

### Modifies 5 Existing Tables
- `profiles` - Adds account_status, warnings tracking
- `businesses` - Adds status field
- `listings` - Adds hide tracking
- `reports` - Already exists, RLS policies added
- `admins` - Sets up auto-verification trigger

### Creates 15+ RLS Policies
- Admin read/write access for management
- User read access for their own data
- Public read access where applicable

### Adds Database Trigger
- Auto-verifies admin profile when email is added to admins table

## 🚀 Deployment Steps

### Step 1: Copy SQL
```
Location: supabase/admin-power-upgrade.sql
Copy the entire contents
```

### Step 2: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor section
4. Click "New query"

### Step 3: Paste & Execute
1. Paste the SQL content
2. Review the statements
3. Click "Run"
4. Wait for completion (1-2 minutes)
5. Check for errors

### Step 4: Verify
```sql
-- Run these queries to verify everything was created

-- Check admin table has trigger
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trigger_verify_admin_profile';

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('admin_actions', 'admin_notices');

-- Check profiles has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('account_status', 'admin_warnings_count');

-- Check policies exist
SELECT policyname FROM pg_policies 
WHERE tablename IN ('profiles', 'listings', 'businesses');
```

### Step 5: Add Admin (if not already done)
```sql
insert into public.admins (email) values ('mwanginewton107@gmail.com')
on conflict (email) do nothing;
```

## ✅ Post-Deployment

1. **Clear app cache** - Hard refresh browser (Ctrl+Shift+R)
2. **Sign in as admin** - Use the admin email to test
3. **Navigate to /admin** - Should see new dashboard
4. **Check profile** - Verify admin badge appears
5. **Test actions** - Try a simple action like viewing users

## 🔍 Troubleshooting

### Issue: SQL execution fails
- **Check**: Are you using the correct Supabase project?
- **Check**: Does your user have admin permissions?
- **Try**: Execute statements one by one instead of all at once

### Issue: Policies error
- **Check**: All policies use the same admin email check
- **Check**: Syntax: `(auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com'`

### Issue: Admin page shows "Access Denied"
- **Check**: Did you add email to admins table?
- **Check**: Are you signed in with the correct email?
- **Check**: Did the trigger execute? Check profiles table for admin badge

### Issue: Tables don't appear
- **Check**: Run the CREATE TABLE statements individually
- **Check**: Check error logs in Supabase dashboard
- **Try**: Drop and recreate table if needed

## 🆘 Rollback Plan

If something goes wrong:

```sql
-- Drop new tables
DROP TABLE IF EXISTS public.admin_actions CASCADE;
DROP TABLE IF EXISTS public.admin_notices CASCADE;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_verify_admin_profile ON public.admins;
DROP FUNCTION IF EXISTS public.verify_admin_profile();

-- Remove new columns from existing tables
ALTER TABLE public.profiles DROP COLUMN IF EXISTS account_status;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_admin_warning;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS admin_warnings_count;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS status;
ALTER TABLE public.listings DROP COLUMN IF EXISTS hidden_reason;
ALTER TABLE public.listings DROP COLUMN IF EXISTS hidden_by;
ALTER TABLE public.listings DROP COLUMN IF EXISTS hidden_at;

-- Drop new policies (can also be dropped individually if needed)
DROP POLICY IF EXISTS "Admin can view all listings" ON public.listings;
DROP POLICY IF EXISTS "Admin can update any listing" ON public.listings;
DROP POLICY IF EXISTS "Admin can delete any listing" ON public.listings;
-- ... etc
```

## 📊 Schema Changes Summary

```
PROFILES TABLE
  ├── NEW: account_status (active | suspended | banned)
  ├── NEW: last_admin_warning (timestamp)
  ├── NEW: admin_warnings_count (integer)
  ├── MODIFIED: RLS policies for admin access
  └── INDEX: idx_profiles_account_status

BUSINESSES TABLE
  ├── NEW: status (active | suspended | terminated)
  ├── MODIFIED: RLS policies for admin access
  └── INDEX: idx_businesses_status

LISTINGS TABLE
  ├── NEW: hidden_reason (text)
  ├── NEW: hidden_by (uuid FK to auth.users)
  ├── NEW: hidden_at (timestamp)
  ├── MODIFIED: RLS policies for admin access
  └── INDEX: idx_listings_hidden_by

REPORTS TABLE (existing)
  └── MODIFIED: Added RLS policies for admin access

ADMIN_ACTIONS TABLE (NEW)
  ├── id (uuid primary key)
  ├── admin_id (uuid FK to auth.users)
  ├── action_type (enum: user_suspend, business_approve, etc)
  ├── target_type (enum: user, business, listing, verification, report)
  ├── target_id (uuid)
  ├── reason (text)
  ├── details (text)
  ├── created_at (timestamp)
  └── INDEXES: admin_id, action_type

ADMIN_NOTICES TABLE (NEW)
  ├── id (uuid primary key)
  ├── user_id (uuid FK to auth.users)
  ├── admin_id (uuid FK to auth.users)
  ├── notice_type (enum: warning, suspension, verification_rejected, etc)
  ├── title (text)
  ├── message (text)
  ├── related_id (uuid)
  ├── read (boolean)
  ├── archived (boolean)
  ├── created_at (timestamp)
  └── INDEXES: user_id, notice_type
```

## 🔐 Security Considerations

### Admin Email Check
All policies use: `(auth.jwt() ->> 'email') = 'mwanginewton107@gmail.com'`

This ensures:
- ✅ Only authenticated users can access
- ✅ Only the specific admin email has permissions
- ✅ JWT is cryptographically verified
- ✅ Session can't be forged client-side

### Audit Trail
All admin actions logged to `admin_actions` table:
- Admin ID (who did it)
- Action type (what they did)
- Target ID (what they acted on)
- Reason/details
- Timestamp (when)

### Data Isolation
- Users only see their own notifications
- Users only see their own profiles
- Admins see everything for moderation
- System-level data not accessible to users

## 📞 Support

If you encounter issues:
1. Check the SQL syntax for typos
2. Verify admin email is correct
3. Clear browser cache
4. Check Supabase logs for error details
5. Review this guide's troubleshooting section

## ✨ Next Steps

After successful deployment:
1. Test admin login at `/admin`
2. Verify all tabs load without errors
3. Try a user management action
4. Check that audit trail is populated
5. Verify notifications are sent

---

**Remember**: The core posting/auth/upload systems should be stable before heavily using admin features!
