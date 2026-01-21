# Database Schema Updates - Notifications Table

## 🎯 Problem Solved

**Issue:** The assessment README referenced a `notifications` table that didn't exist in the database schema, causing confusion for candidates about where notifications come from.

**Solution:** Added the notifications table to the schema migrations and provided seed data.

---

## 📝 Changes Made

### 1. Schema Migration (`001_initial_schema.sql`)

Added notifications table creation to the `create_candidate_schema()` function:

```sql
CREATE TABLE IF NOT EXISTS {schema}.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention')),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes added:**
- `idx_notifications_created_at` - For sorting by time
- `idx_notifications_read` - For filtering unread notifications

---

### 2. Seed Data (`002_seed_data.sql`)

Added example INSERT statements showing how to seed 5 notifications:
- **3 unread:** sarah_dev (like), john_code (comment), emma_ui (follow)
- **2 read:** alex_full (like), lisa_pm (comment)

---

### 3. Helper Function (`006_seed_notifications_helper.sql`)

Created `seed_candidate_notifications(candidate_id)` function that:
- Automatically inserts 5 sample notifications
- Uses realistic content matching the Instagram UI
- Sets proper timestamps (2 hours ago, 5 hours ago, etc.)
- Can be called after `create_candidate_schema()`

**Usage:**
```sql
SELECT create_candidate_schema('test_candidate');
SELECT seed_candidate_notifications('test_candidate');
```

---

### 4. README Updates

**Added clarification in Step 1:**
> Your database already contains 5 sample notifications (3 unread, 2 read) from users like `sarah_dev`, `john_code`, and `emma_ui`. You'll fetch and display these.

**Updated database documentation:**
- Changed from generic JSON structure to actual SQL schema
- Listed the 5 pre-seeded notification examples
- Clarified that 3 are unread, 2 are read

---

## 🎯 Candidate Experience Now

### Before (Confusing)
1. Opens assessment
2. Sees "notifications table already exists" in README
3. Tries to query it → **Table doesn't exist!**
4. Confused about where notifications come from
5. Wastes time debugging infrastructure

### After (Clear)
1. Opens assessment
2. Sees "5 sample notifications already in database"
3. Queries notifications table → **Gets 5 results!**
4. Understands the data immediately
5. Starts implementing features right away

---

## 📊 Table Structure

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Unique notification ID |
| `user_id` | UUID | NOT NULL | User who receives notification |
| `type` | TEXT | CHECK constraint | One of: like, comment, follow, mention |
| `content` | TEXT | NOT NULL | Notification message |
| `read` | BOOLEAN | DEFAULT false | Whether notification has been read |
| `created_at` | TIMESTAMP | DEFAULT NOW() | When notification was created |

---

## 🔧 Next Steps

When provisioning a new candidate environment, make sure to:

1. Run `create_candidate_schema(candidate_id)` - Creates schema + tables
2. Run `seed_candidate_notifications(candidate_id)` - Populates sample data
3. Candidate can immediately start querying and see 5 notifications

This ensures every candidate has a consistent starting point with realistic data to work with!

---

## ✅ Verification

To verify the setup works:

```sql
-- Create test schema
SELECT create_candidate_schema('test_user');

-- Seed notifications
SELECT seed_candidate_notifications('test_user');

-- Verify data exists
SELECT * FROM sandbox_test_user.notifications ORDER BY created_at DESC;
-- Should return 5 rows (3 with read=false, 2 with read=true)

-- Verify unread count
SELECT COUNT(*) FROM sandbox_test_user.notifications WHERE read = false;
-- Should return 3
```
