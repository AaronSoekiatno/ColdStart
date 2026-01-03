# GitHub Webhook Testing Setup

## Prerequisites

- ✅ Supabase database created (run `lib/supabase-schema.sql`)
- ✅ GitHub repository created by your partner
- ✅ Environment variables configured

---

## Step 1: Expose Your Local Server (Development)

Since GitHub can't reach `localhost`, you need to expose your server publicly.

### Option A: Using ngrok (Recommended)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Run your dev server first
npm run dev  # Should start on port 3000

# In a new terminal, expose it
ngrok http 3000

# You'll get an output like:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

---

## Step 2: Add Webhook to GitHub Repository

1. Go to your test repository on GitHub
2. Click **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `https://abc123.ngrok.io/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Create a random string (e.g., `your-webhook-secret-123`)
   - **Which events**: Select **"Just the push event"**
   - **Active**: ✅ Checked

4. Click **Add webhook**

---

## Step 3: Add Webhook Secret to Environment

```bash
# Add to .env.local
echo "GITHUB_WEBHOOK_SECRET=your-webhook-secret-123" >> .env.local
```

**Restart your dev server** after adding the secret.

---

## Step 4: Create a Test Session

Create a simple test script:

```bash
# test-webhook-flow.js
node test-webhook-flow.js
```

Or manually via Node REPL:

```bash
node
```

```javascript
// In Node REPL
import('./lib/session-manager.js').then(async ({ createSession, updateSession, startInterview }) => {
  // 1. Create session
  const session = await createSession('test-candidate-123');
  console.log('Session created:', session.sessionId);
  
  // 2. Link to your partner's repo
  await updateSession(session.sessionId, {
    repoName: 'YOUR_REPO_NAME',  // ← Replace with actual repo name
    repoUrl: 'https://github.com/OWNER/YOUR_REPO_NAME'  // ← Replace
  });
  
  // 3. Start interview (moves to KICK_OFF, then BUILD)
  await startInterview(session.sessionId);
  console.log('Interview started!');
  
  console.log('🎯 Now push a commit to the repo to test webhook');
});
```

---

## Step 5: Test the Webhook

### Make a test commit to the repository:

```bash
# Clone the repo (if you haven't)
git clone https://github.com/OWNER/YOUR_REPO_NAME
cd YOUR_REPO_NAME

# Make a change
echo "Test commit for Minerva" > test.txt
git add .
git commit -m "Test: BUILD phase commit"
git push origin main
```

### Watch the logs:

**In your dev server terminal**, you should see:
```
[Webhook] Received push event from OWNER/YOUR_REPO_NAME
[Webhook] Commits: 1
[Webhook] Processing commit: abc1234 - Test: BUILD phase commit
[Webhook] ✅ Phase transition triggered for session YOUR_REPO_NAME
[Orchestrator] Transitioning phase for session YOUR_REPO_NAME, trigger: commit
[Session] Transitioned from BUILD to BUG_INJECTION
```

---

## Step 6: Verify in Supabase

1. Go to Supabase Dashboard → Table Editor
2. Open `interview_sessions` table
3. Find your session row
4. Check:
   - `current_phase` should be `"BUG_INJECTION"`
   - `phase_history` should show the BUILD → BUG_INJECTION transition
   - `phases.BUILD.commits` should contain your commit

---

## Troubleshooting

### Webhook not firing?

**Check GitHub webhook deliveries:**
1. GitHub repo → Settings → Webhooks
2. Click on your webhook
3. Click "Recent Deliveries" tab
4. Look for red X (failed) or green ✓ (success)
5. Click to see request/response details

### "Invalid signature" error?

- Make sure `GITHUB_WEBHOOK_SECRET` in `.env.local` matches GitHub webhook secret
- Restart your dev server after adding the secret

### "Session not found" error?

- Make sure repo name matches session ID (or implement the mapping function)
- Check that session was created and linked to the correct repo

### No logs in terminal?

- Verify ngrok is running
- Check ngrok web interface: http://localhost:4040 (shows all requests)
- Verify dev server is running

---

## What to Give Me for Testing

Please provide:

1. **Repository URL**: `https://github.com/YOUR_ORG/YOUR_REPO`
2. **Repository name**: (e.g., `minerva-test-interview`)
3. **Did you run the Supabase SQL migration?** (Yes/No)
4. **Are you using Next.js?** (I created Next.js webhook endpoint)
5. **ngrok URL** (once you run it): `https://abc123.ngrok.io`

Then I can help you:
- Create a test session linked to that repo
- Verify webhook is working
- Test the full commit → phase transition flow
