# Claude API Cost Reduction Strategies

## ✅ Implemented Optimizations

### 1. **Scoped Read Access** (Merged)
Prevents Claude from reading unnecessary files:
- ✅ Blocks `node_modules/`, `.next/`, `dist/`, `build/`, `.git/`
- ✅ Only allows reading source code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.css`, `.html`)
- **Savings**: Prevents large context from dependency files

### 2. **Model Selection - Haiku by Default** (NEW)
```bash
CLAUDE_MODEL="${CLAUDE_MODEL:-claude-3-5-haiku-latest}"
```
- Haiku: ~$0.25/$1.25 per MTok (input/output)
- Sonnet: ~$3/$15 per MTok (input/output)
- **Savings: ~12x cheaper for routine tasks!**

To use Sonnet for complex tasks, set:
```bash
CLAUDE_MODEL=claude-3-5-sonnet-latest
```

### 3. **Max Turns Limit** (NEW)
```bash
CLAUDE_MAX_TURNS="${CLAUDE_MAX_TURNS:-5}"
```
Prevents agentic loops from spiraling into expensive multi-turn conversations.
- Default: 5 turns max per prompt
- **Savings**: Caps runaway tool-use chains

### 4. **Session Call Limit** (NEW)
```bash
CLAUDE_SESSION_CALL_LIMIT="${CLAUDE_SESSION_CALL_LIMIT:-50}"
```
Limits candidates to 50 Claude API calls per assessment session.
- Prevents abuse or excessive prompting
- **Savings**: Hard cap on per-session costs

### 5. **Input Token Limit** (Already existed)
```bash
CLAUDE_PROMPT_TOKEN_LIMIT="${CLAUDE_PROMPT_TOKEN_LIMIT:-5000}"
```
Rejects prompts over ~5000 tokens (estimated via `length/4`).

---

## 📊 Cost Estimation

| Model | Input (per MTok) | Output (per MTok) | 5k prompt + 2k response |
|-------|------------------|-------------------|-------------------------|
| Haiku | $0.25 | $1.25 | ~$0.0038 |
| Sonnet | $3.00 | $15.00 | ~$0.045 |
| **Savings** | | | **~12x** |

With 50 calls per session limit:
- **Haiku**: Max ~$0.19/session
- **Sonnet**: Max ~$2.25/session

---

## 🔧 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MODEL` | `claude-3-5-haiku-latest` | Which Claude model to use |
| `CLAUDE_MAX_TURNS` | `5` | Max agentic turns per prompt |
| `CLAUDE_SESSION_CALL_LIMIT` | `50` | Max API calls per session |
| `CLAUDE_PROMPT_TOKEN_LIMIT` | `5000` | Max input tokens per prompt |
| `CLAUDE_MAX_OUTPUT_TOKENS` | `4096` | Max output tokens (not yet enforced via CLI) |

---

## 🚀 Additional Recommendations

### Short-term (Easy to implement)
1. **Daily/Monthly budget alerts** via Anthropic Console
2. **Key rotation** - Create separate API keys per environment
3. **Usage dashboards** - Monitor via `analyze-claude-usage.ts`

### Medium-term (Requires more work)
1. **Prompt caching** - Cache common file contents to reduce context
2. **Temperature reduction** - Lower temperature = more deterministic = fewer retries
3. **Task tiering** - Route simple tasks to Haiku, complex to Sonnet

### Long-term (Architectural)
1. **Rate limiting by candidate** - Supabase Edge Function to enforce per-user limits
2. **Pre-processing** - Summarize large files before sending to Claude
3. **Streaming responses** - Stop generation early when answer is complete

---

## 🔄 Deployment

After changes, rebuild and push the Docker image:
```bash
docker build -f docker/Dockerfile.assessment -t registry.fly.io/hermes-assessment:latest .
docker push registry.fly.io/hermes-assessment:latest
```

New containers will automatically use the cost-saving defaults.
