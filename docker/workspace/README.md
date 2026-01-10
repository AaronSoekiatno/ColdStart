# 🚨 MISSION BRIEFING: ABSURD DATA FLYWHEEL [P0 - 20 MINS]

## 🔴 THE SITUATION
The **Absurd Data Flywheel** is broken. This is a P0 production incident.

Our creative engine generates video scripts, tracks their performance, and feeds insights back into the system to improve future scripts. This flywheel is the core of our product—without it, we're flying blind. The agents can't learn from what works. The creatives can't see which hooks drive viral performance. The entire feedback loop has stalled.

**The clock is ticking.** You have 20 minutes to restore the flywheel and prove this system can ship.

**Mission:** Fix the Absurd Data Flywheel. Get insights flowing from performance data back into script generation. Ship with Gemini 2.5 Pro.

---

## 🛠 SETUP: AUTOMATED PROVISIONING

Your assessment repository is **pre-configured** with credentials injected by our provisioning system. Setup takes **2 minutes**.

### Prerequisites
- **Node.js** >= 18 (check with `node --version`)
  - Download from [nodejs.org](https://nodejs.org/) if needed
- **Yarn** package manager (install with `npm install -g yarn` if needed)
- **Git** (for cloning the repo)

**Works on:** Windows, macOS, and Linux

---

## 🚀 QUICK START (2 MINUTES)

### 1. Clone Your Assessment Repository

<<<<<<< HEAD
2. **Install Dependencies**
   ```bash
   yarn install
   ```
   *(If `yarn` is not found, install it: `npm install -g yarn`)*
   
   > **Windows users:** If you encounter permission issues, try running your terminal as Administrator or use `npm install` instead.
   
   > **Note:** The setup script will automatically configure Cursor hooks for prompt tracking.
=======
You received a repository URL from the assessment platform. Clone it:
>>>>>>> 27e4298 (removed  moved MDs that could potentially help the candidate out too much)

```bash
git clone <YOUR_ASSESSMENT_REPO_URL>
cd <repo-name>
```

> **Important:** This is NOT a fork. Your repository was created specifically for you with credentials pre-injected.

### 2. Install Dependencies

<<<<<<< HEAD
6. **Setup Cursor Hooks (Automatic Prompt Tracking)**
   
   The setup script automatically configures Cursor hooks for tracking AI prompts. After `yarn install`:
   
   - ✅ Cursor hooks are automatically configured
   - ⚠️ **IMPORTANT:** Restart Cursor IDE to activate hooks
   
   **What this means:**
   - Use Cursor normally with your own API keys (GPT-4, Claude, Gemini, etc.)
   - All prompts are tracked automatically in the background
   - No Cursor settings configuration needed
   - Hooks work with any AI model you use in Cursor
   
   **⚠️ Known Issue:** There's a known bug in Cursor (versions 2.1.25+ on Windows) where `beforeSubmitPrompt` hooks may be called but not receive prompt data. If prompts aren't being logged:
   - Check Cursor's Output panel (Output tab → "Hooks" dropdown) to see what data Cursor is sending
   - Update Cursor to the latest version
   - Check `.cursor/logs/prompts-YYYYMMDD.log` for debug information

7. **Open Your Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)
=======
```bash
yarn install
```
>>>>>>> 27e4298 (removed  moved MDs that could potentially help the candidate out too much)

**What happens automatically:**
- All dependencies install
- `postinstall` script runs `auto-setup.js`
- Auto-provisioning attempts to fetch credentials from the Quartermaster API
- If successful, `.env.local` is created with all required credentials
- You'll see Cursor setup instructions (optional - for AI coding assistance)

> **Note:** If auto-provisioning doesn't complete, proceed to step 3.

### 3. Provision Credentials (If Needed)

If auto-setup didn't complete or you need to refresh credentials:

```bash
yarn mission:start
```

<<<<<<< HEAD
- **"yarn: command not found"** → Run `npm install -g yarn`
- **"GOOGLE_API_KEY is not defined"** → Check your `.env.local` file exists and has the key
- **Port 3000 already in use:**
  - **macOS/Linux:** `PORT=3001 yarn dev`
  - **Windows (PowerShell):** `$env:PORT=3001; yarn dev`
  - **Windows (CMD):** `set PORT=3001 && yarn dev`
- **Module not found errors** → Run `yarn install` again
- **Windows: "touch is not recognized"** → Use `New-Item .env.local` in PowerShell or create the file manually
- **Windows: Permission denied** → Run your terminal as Administrator or use a different port
- **Cursor hooks not found** → Make sure the `.cursor/` directory with hooks exists in the repository
- **Hooks not working** → Make sure you restarted Cursor IDE completely after setup
=======
**This script:**
- Contacts the Quartermaster provisioning API
- Fetches temporary credentials (Gemini API proxy + Supabase access)
- Writes credentials to `.env.local`
- Validates the configuration
>>>>>>> 27e4298 (removed  moved MDs that could potentially help the candidate out too much)

**Expected output:**
```
🔑 Quartermaster: Provisioning credentials...
ℹ Contacting Quartermaster at <API_URL>...
✓ Credentials written to .env.local

Provisioned credentials:
  ✓ OPENAI_API_KEY
  ✓ OPENAI_BASE_URL
  ✓ SUPABASE_URL
  ✓ SUPABASE_PRIVATE_KEY
  ✓ SUPABASE_ANON_KEY

Ready for mission!
```

> **Technical Details:** The `QUARTERMASTER_API_URL` is injected into your repository's `.env.local` during creation. The provisioning token authenticates you to receive temporary, scoped credentials.

### 4. Start Development

```bash
yarn dev
```

Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🎯 THE MISSION

**Your task:** Unlock the 🔒 Insights tab and restore the data flywheel.

### Success Criteria
1. **Remove the lock** - The Insights tab should be accessible
2. **Fetch performance data** - Load data from the database via `/api/insights/performance`
3. **Display metrics** - Show views, likes, shares, viral_score for each script
4. **Highlight top performers** - Visual indication for scripts with viral_score > 0.7
5. **Gemini summaries** (Enhanced) - AI-generated insights about top performers

**Time limit:** 20 minutes

**Database Schema:**
- `video_scripts` - Generated video scripts with metadata
- `performance_logs` - Performance metrics (views, likes, shares, viral_score)
- Join on `script_id` to combine data

---

## 📊 HOW SCORING WORKS

Your assessment is **automatically scored** via Vitest tests that run on every push.

### Scoring Breakdown

| Category | Points | What It Tests |
|----------|--------|---------------|
| Build & Types | 15 | Compiles without errors, TypeScript correctness |
| Core Requirements | 35 | Lock removed, fetching data, displaying metrics, highlighting |
| Enhanced Features | 25 | Sorting, loading states, error handling, Gemini integration |
| Reflection | 20 | Manual evaluation of your writeup (not automated) |

**Total: 95 points** (75 automated + 20 manual)

### Automated Testing

Every time you push code, GitHub Actions runs:
1. `yarn test:score` - Runs Vitest test suite
2. Parses JSON results to calculate scores per category
3. Applies penalties (e.g., -10 for removing SQL index from migrations)
4. Submits scores to Supabase with full test artifacts
5. Logs commit metrics (lines added/deleted, diff content) for forensic analysis

**View your scores:** Check the Actions tab in your GitHub repository after pushing.

### Test Locally

```bash
# Run all assessment tests
yarn test

# Watch mode (re-runs on changes)
yarn test:watch

# Generate JSON score report (what CI uses)
yarn test:score
```

---

## 🔍 WHAT YOUR REPOSITORY INCLUDES

Your assessment repository comes pre-configured with:

### Automated Scripts

- **`scripts/provision-key.js`** - Fetches credentials from Quartermaster API
- **`scripts/auto-setup.js`** - Runs on `yarn install` to auto-provision

### GitHub Actions Workflows

- **`.github/workflows/check_push.yaml`** - Logs every commit to Supabase with diff content
- **`.github/workflows/score_assessment.yaml`** - Runs tests and calculates scores on push

### Database Migrations

- **`supabase/migrations/001_initial_schema.sql`** - Creates tables
- **`supabase/migrations/002_seed_data.sql`** - Sample data for testing
- **`supabase/migrations/003_forensic_metrics.sql`** - Session tracking
- **`supabase/migrations/004_assessment_scores.sql`** - Score storage

### Assessment Tests

- **`tests/assessment/build.test.ts`** - Build verification
- **`tests/assessment/completion.test.ts`** - Core functionality
- **`tests/assessment/enhanced.test.ts`** - Advanced features
- **`tests/assessment/sabotage.test.ts`** - Detects removed safeguards
- **`tests/assessment/type-safety.test.ts`** - Checks for excessive `any` usage

---

## ⚙️ ENVIRONMENT VARIABLES EXPLAINED

Your `.env.local` contains these credentials (auto-provisioned):

```env
# Gemini API Proxy (managed by platform)
OPENAI_API_KEY=<your-candidate-id>
OPENAI_BASE_URL=<platform-proxy-url>

# Supabase (temporary, scoped to your candidate schema)
SUPABASE_URL=<project-url>
SUPABASE_PRIVATE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anonymous-key>
```

**Why OpenAI variables for Gemini?**
- The platform uses an OpenAI-compatible proxy for Gemini 2.5 Pro
- This allows Cursor IDE to work with Gemini via OpenAI API compatibility
- Your `OPENAI_API_KEY` is actually your candidate ID for tracking usage

**Supabase Credentials:**
- Temporary credentials scoped to your candidate schema
- Automatically provisioned for your assessment duration
- Includes pre-loaded seed data for testing

---

## 🧪 TESTING FOR PRODUCTION

Before submitting your assessment, verify everything works:

### 1. Run Local Tests

```bash
# All tests should pass
yarn test

# Check build
yarn build
```

### 2. Verify Functionality

1. **Navigate to Insights tab** - Should be unlocked
2. **Data loads** - Performance metrics visible
3. **Highlighting works** - Top scripts visually distinct
4. **No console errors** - Check browser DevTools
5. **Loading states** - Shows loading indicator while fetching
6. **Error handling** - Graceful degradation if API fails

### 3. Check GitHub Actions

1. Push your code to your repository
2. Go to **Actions** tab on GitHub
3. Wait for workflows to complete
4. Check the **score_assessment.yaml** workflow output
5. Review your automated score

### 4. Verify Data Persistence

Every push automatically logs:
- Commit hash, author, timestamp, message
- Lines added/deleted
- Full diff content (excluding noise files)
- Stored in `session_commits` table in Supabase

This forensic data is used to:
- Detect AI usage patterns
- Track development velocity
- Identify copy-paste behavior
- Analyze problem-solving approach

---

## ⚡ TROUBLESHOOTING

### Provisioning Issues

**Error: "Failed to provision credentials"**
- Check that `QUARTERMASTER_API_URL` exists in `.env.local`
- Ensure you're connected to the internet
- Contact the assessment administrator if the API is unreachable

**Error: "401 Unauthorized"**
- Your provisioning token may have expired
- Contact the assessment administrator for a new token

### Build Issues

**Port 3000 already in use:**
- **macOS/Linux:** `PORT=3001 yarn dev`
- **Windows (PowerShell):** `$env:PORT=3001; yarn dev`
- **Windows (CMD):** `set PORT=3001 && yarn dev`

**Module not found errors:**
- Delete `node_modules` and `yarn.lock`
- Run `yarn install` again
- If on Windows, try running terminal as Administrator

**TypeScript errors:**
- Run `yarn build` to see all errors
- Check that all imports are correct
- Ensure you haven't introduced `any` types excessively

### Database Issues

**Error: "Cannot connect to Supabase"**
- Verify `SUPABASE_URL` and `SUPABASE_PRIVATE_KEY` in `.env.local`
- Check that credentials haven't expired
- Try running `yarn mission:start` to refresh credentials

**No data in Insights tab:**
- Migrations may not have run
- Contact administrator to verify seed data is loaded
- Check browser DevTools Network tab for API errors

---

## 📚 ADDITIONAL RESOURCES

### Documentation
- [LangChain.js Docs](https://js.langchain.com/)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Vitest Docs](https://vitest.dev/)

### Assessment Details
- See `testing/testing_suite.md` for detailed test criteria
- Check `tests/assessment/*.test.ts` files to understand evaluation

---

## ⏱️ FINAL CHECKLIST

Before you submit:

- [ ] Code compiles without errors (`yarn build`)
- [ ] All tests pass locally (`yarn test`)
- [ ] Insights tab is unlocked and functional
- [ ] Performance data displays correctly
- [ ] High performers are highlighted
- [ ] No console errors in browser
- [ ] Code is pushed to your GitHub repository
- [ ] GitHub Actions workflows completed successfully
- [ ] Reviewed your automated score in Actions tab

**Mission:** Restore the Absurd Data Flywheel  
**Priority:** P0 - Production Incident  
**Time Limit:** 20 minutes  
**Success Criteria:** Insights dashboard operational, performance data flowing, Gemini summaries generating, feedback loop restored.

**The flywheel must spin. Start the timer.**