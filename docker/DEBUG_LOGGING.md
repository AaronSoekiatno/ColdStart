# Debugging Claude Prompt Logging

## Problem
Prompts are not being logged to Supabase after switching to interactive mode.

## Debug Mode

Debug mode is now **enabled by default**. All hook activity is logged to:
- **stderr**: Visible in container logs
- **File**: `/tmp/claude-hook-debug.log` (if DEBUG_PROMPT_LOGGING=true)

## Step-by-Step Debugging

### 1. Check Container Logs

```bash
# View the startup logs
docker logs hermes-assessment-<candidate_id>

# Look for these lines:
# ✓ Hook installed at /home/coder/.claude/hooks/log-prompt.sh
# ✓ Hook is executable
# ✓ Claude hooks configured in settings.json
```

### 2. Exec into the Container

```bash
docker exec -it hermes-assessment-<candidate_id> bash
```

### 3. Verify Hook Installation

```bash
# Check the hook exists
ls -la /home/coder/.claude/hooks/log-prompt.sh

# Check it's executable
test -x /home/coder/.claude/hooks/log-prompt.sh && echo "Executable" || echo "NOT executable"

# Check settings.json has hooks configured
cat /home/coder/.claude/settings.json | grep -A 2 "hooks"
```

Expected output:
```json
"hooks": {
  "UserPromptSubmit": "/home/coder/.claude/hooks/log-prompt.sh"
}
```

### 4. Test the Hook Manually

```bash
# Run the test script
test-hook

# Or manually:
echo '{"prompt": "test prompt", "session_id": "test-session", "cwd": "/workspace", "permission_mode": "ask"}' | bash -x /home/coder/.claude/hooks/log-prompt.sh
```

Expected output should show:
```
[PromptLog HH:MM:SS] === Hook triggered ===
[PromptLog HH:MM:SS] SUPABASE_URL: https://your-project.supabase.co
[PromptLog HH:MM:SS] SUPABASE_SERVICE_KEY: ***SET***
[PromptLog HH:MM:SS] CANDIDATE_ID: <your-candidate-id>
```

### 5. Check Environment Variables

```bash
# Inside the container:
echo "SUPABASE_URL: $SUPABASE_URL"
echo "SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:+***SET***}"
echo "CANDIDATE_ID: $CANDIDATE_ID"
echo "DEBUG_PROMPT_LOGGING: $DEBUG_PROMPT_LOGGING"
```

All should be set. If not:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` should come from your .env.local
- `SUPABASE_SERVICE_KEY` is mapped from `SUPABASE_SERVICE_ROLE_KEY` in entrypoint.sh

### 6. Run Claude and Monitor Hooks

```bash
# In one terminal, tail the debug log:
tail -f /tmp/claude-hook-debug.log

# In another terminal, run Claude:
claude

# Type a prompt and submit
# You should see hook activity in the debug log
```

### 7. Check Supabase Table

```sql
-- Check if logs are being written
SELECT * FROM admin_audit.prompt_logs 
WHERE candidate_id = '<your-candidate-id>'
ORDER BY created_at DESC
LIMIT 10;
```

## Common Issues

### Issue: Hook Not Being Called

**Symptoms**: No debug output when using Claude

**Causes**:
1. Claude settings.json doesn't have the hook configured
2. Hook path is incorrect
3. Claude Code version doesn't support hooks

**Fix**:
```bash
# Check Claude Code version
claude --version

# Manually configure hooks in settings.json
python3 << 'EOF'
import json
with open('/home/coder/.claude/settings.json', 'r+') as f:
    data = json.load(f)
    data['hooks'] = {'UserPromptSubmit': '/home/coder/.claude/hooks/log-prompt.sh'}
    f.seek(0)
    f.truncate()
    json.dump(data, f, indent=2)
EOF
```

### Issue: Hook Called But No Logs in Supabase

**Symptoms**: Debug log shows hook activity but no rows in database

**Causes**:
1. SUPABASE_SERVICE_KEY is not set
2. Supabase endpoint is wrong
3. Table permissions issue

**Fix**:
```bash
# Test Supabase connection directly
curl -X POST "$SUPABASE_URL/rest/v1/prompt_logs" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_id": "'$CANDIDATE_ID'",
    "provider": "test",
    "tool_name": "Manual Test",
    "prompt_text": "test prompt",
    "prompt_text_preview": "test prompt"
  }'
```

### Issue: Permission Denied

**Symptoms**: Hook shows "permission denied" errors

**Fix**:
```bash
chmod +x /home/coder/.claude/hooks/log-prompt.sh
chown coder:coder /home/coder/.claude/hooks/log-prompt.sh
```

## Environment Variables Required

```bash
# Authentication
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Supabase (for logging)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...  # or SUPABASE_SERVICE_ROLE_KEY

# Tracking
CANDIDATE_ID=uuid-here
SESSION_ID=session-id-here

# Debug
DEBUG_PROMPT_LOGGING=true  # Enable verbose logging
```

## Verification Checklist

- [ ] Container starts without errors
- [ ] Hook file exists at `/home/coder/.claude/hooks/log-prompt.sh`
- [ ] Hook is executable (`-x` permission)
- [ ] `settings.json` contains `hooks.UserPromptSubmit` path
- [ ] All environment variables are set
- [ ] `test-hook` command runs without errors
- [ ] Running `claude` triggers hook (visible in debug log)
- [ ] Prompts appear in `admin_audit.prompt_logs` table

## Contact

If issues persist after following this guide:
1. Capture the output of `docker logs <container-id>`
2. Capture the contents of `/tmp/claude-hook-debug.log`
3. Run `test-hook` and capture output
4. Check Supabase logs for any errors
