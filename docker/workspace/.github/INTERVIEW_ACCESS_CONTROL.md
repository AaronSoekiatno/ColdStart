# 🔒 Interview Access Control Guide

## ⚠️ The Fork Problem

**Critical Limitation:** Once a candidate forks your repository, **you cannot revoke their access**. They own that fork permanently.

```
Your Seed Repo (Public/Private)
    ↓ [Fork]
Candidate's Fork (They own this forever!)
    ↓ ❌ You can't delete or revoke access
```

## ✅ Solutions

### Option 1: Make Seed Repo Private (Quick Fix)

**After each interview:**
1. Go to your seed repo → Settings → Danger Zone
2. Click "Change visibility" → "Make private"
3. This prevents new forks, but existing forks remain accessible to candidates

**Limitations:**
- ❌ Existing forks still accessible
- ❌ You need to make it public again for next interview
- ✅ Quick and simple

### Option 2: Use Template Repository (Recommended)

**Convert your seed repo to a Template:**

1. Go to repo Settings → General
2. Scroll to "Template repository"
3. ✅ Check the box
4. Save

**Benefits:**
- ✅ Candidates use "Use this template" instead of fork
- ✅ Creates a NEW repo (not a fork) - you can control it
- ✅ No permanent connection to your seed repo
- ✅ You can delete template-generated repos after interview

**Workflow:**
```
Candidate clicks "Use this template"
    ↓
Creates: candidate-username/interview-repo-2026-01-02
    ↓
You can add/remove them as collaborator
    ↓
After interview: Delete the repo ✅
```

### Option 3: GitHub API - Create Repos Programmatically (Best for Automation)

Use GitHub API to create repos from template and manage access:

```javascript
// When interview starts
const repo = await github.repos.createUsingTemplate({
  template_owner: 'YOUR_ORG',
  template_repo: 'seed-repo',
  name: `interview-${candidateName}-${timestamp}`,
  private: true
});

// Add candidate as collaborator
await github.repos.addCollaborator({
  owner: 'YOUR_ORG',
  repo: repo.data.name,
  username: candidateUsername,
  permission: 'push'
});

// After interview ends
await github.repos.removeCollaborator({
  owner: 'YOUR_ORG',
  repo: repo.data.name,
  username: candidateUsername
});

// Delete the repo
await github.repos.delete({
  owner: 'YOUR_ORG',
  repo: repo.data.name
});
```

## 🛠 Implementation Steps

### For Fork-Based Workflow (Current)

1. **Before Interview:**
   - Keep seed repo public (or add candidates as collaborators if private)

2. **During Interview:**
   - Candidate forks the repo
   - They work in their fork

3. **After Interview:**
   - Run the cleanup workflow: `.github/workflows/post-interview-cleanup.yml`
   - Or manually make repo private
   - Note: Their fork remains accessible (limitation)

### For Template-Based Workflow (Recommended)

1. **Setup:**
   - Convert seed repo to Template Repository
   - Update README to say "Use this template" instead of "Fork"

2. **During Interview:**
   - Candidate uses template to create new repo
   - You add them as collaborator via API

3. **After Interview:**
   - Remove candidate as collaborator ✅
   - Archive or delete the repo ✅
   - Full control!

## 📋 GitHub Actions Workflow

The `.github/workflows/post-interview-cleanup.yml` workflow helps with cleanup:

**Manual Trigger:**
```bash
gh workflow run post-interview-cleanup.yml \
  -f candidate_username=john-doe \
  -f interview_repo=john-doe/seed-repo
```

**Scheduled:**
- Runs daily at 2 AM UTC
- Detects all forks
- Generates cleanup report

## 🔐 Security Best Practices

1. **Never put secrets in the seed repo** - Use GitHub Secrets or temporary keys
2. **Use time-limited API keys** - Generate keys that expire after interview
3. **Monitor fork activity** - Set up webhooks to track forks
4. **Archive old repos** - Clean up after 30 days
5. **Use Template Repository** - Best practice for interview workflows

## 🚀 Quick Migration to Template

1. Make seed repo a Template Repository (Settings → Template repository)
2. Update README.md to change "Fork this repo" → "Use this template"
3. Update GitHub Actions workflow to handle template repos
4. Test with a dummy account

## 📞 Need Help?

If you need to implement the GitHub API approach, you'll need:
- GitHub Personal Access Token (PAT) with `repo` scope
- Or GitHub App with repository permissions
- Environment variable: `GITHUB_TOKEN` in your CI/CD

