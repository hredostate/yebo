# Ollama Integration - Quick Reference

## Provider Selection

```
┌─────────────────────────────────────────────────┐
│         Settings > AI Configuration             │
├─────────────────────────────────────────────────┤
│                                                 │
│  Select Provider:                               │
│  ┌──────────────┐       ┌──────────────┐       │
│  │  ☁️ OpenRouter│       │  🖥️ Ollama  │       │
│  │  (Cloud)     │       │  (Local)    │       │
│  │  Requires API│       │  Free, No   │       │
│  │  key         │       │  API key    │       │
│  └──────────────┘       └──────────────┘       │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Setup Flow

### Option 1: OpenRouter (Cloud)
```
1. Get API key from openrouter.ai
   ↓
2. Go to Settings > AI Configuration
   ↓
3. Select "OpenRouter (Cloud)"
   ↓
4. Enter API key
   ↓
5. Select model (e.g., GPT-4o)
   ↓
6. Test Connection → Save
   ✓ Ready to use!
```

### Option 2: Ollama (Local)
```
1. Install Ollama from ollama.ai
   ↓
2. Pull a model: ollama pull llama3
   ↓
3. Go to Settings > AI Configuration
   ↓
4. Select "Ollama (Local)"
   ↓
5. Test Connection (auto-detects models)
   ↓
6. Select model from dropdown
   ↓
7. Save
   ✓ Ready to use!
```

## Quick Commands

### Install Ollama

**macOS**:
```bash
brew install ollama
ollama serve
```

**Linux**:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows**: Download from [ollama.ai/download](https://ollama.ai/download)

### Pull Models

```bash
# Recommended for most users (8B params, ~4.7GB)
ollama pull llama3

# Latest version (8B params, ~4.7GB)
ollama pull llama3.1

# Fast and efficient (7B params, ~4.1GB)
ollama pull mistral

# Best quality, needs powerful hardware (70B params, ~40GB)
ollama pull llama3:70b
```

### Check Status

```bash
# See running models
ollama ps

# List installed models
ollama list

# Test Ollama
curl http://localhost:11434/api/tags
```

## Comparison

| Feature | OpenRouter | Ollama |
|---------|------------|--------|
| **Cost** | Pay per use | Free |
| **Privacy** | Data sent to cloud | 100% local |
| **Internet** | Required | Not required |
| **Setup** | API key only | Install + download models |
| **Speed** | Network dependent | Fast (local) |
| **Models** | Many options | Limited to installed |
| **Hardware** | None needed | 8GB+ RAM recommended |
| **Quality** | Excellent | Very good |

## Code Usage

### For Developers

All AI features automatically work with both providers:

```typescript
// In any component
const client = getAIClient(); // Returns active provider

// Use exactly the same way for both providers
const response = await client.chat.completions.create({
  model: getCurrentModel(),
  messages: [
    { role: 'user', content: 'Analyze this report...' }
  ]
});
```

### Switching Providers Programmatically

```typescript
import { setAIProvider, initializeOllamaAIClient } from './services/aiClient';

// Switch to Ollama
setAIProvider('ollama');
initializeOllamaAIClient('http://localhost:11434', 'llama3');

// Switch to OpenRouter
setAIProvider('openrouter');
initializeAIClient(apiKey, 'openai/gpt-4o');
```

## Troubleshooting

### "Connection failed" error

**Check if Ollama is running**:
```bash
# Should return JSON with models
curl http://localhost:11434/api/tags
```

**Start Ollama**:
```bash
ollama serve
```

### "No models found" error

**Pull a model**:
```bash
ollama pull llama3
```

### Slow performance

**Use smaller model**:
```bash
# Instead of llama3:70b, use:
ollama pull llama3  # or llama3:8b
```

### Port conflict

**Change Ollama port**:
```bash
export OLLAMA_HOST=0.0.0.0:8080
ollama serve
```

Then update URL in settings to `http://localhost:8080`

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  School 360 App                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────────────────────────────────────┐     │
│   │  Unified AI Client (getAIClient())       │     │
│   │  - Returns active provider               │     │
│   │  - OpenAI-compatible interface           │     │
│   └──────────────┬───────────────────────────┘     │
│                  │                                   │
│         ┌────────┴────────┐                         │
│         ▼                 ▼                          │
│  ┌─────────────┐   ┌──────────────┐                │
│  │ OpenRouter  │   │   Ollama     │                │
│  │   Client    │   │   Client     │                │
│  │             │   │              │                │
│  │ - API key   │   │ - No key     │                │
│  │ - Cloud     │   │ - Local      │                │
│  │ - $$$       │   │ - Free       │                │
│  └──────┬──────┘   └──────┬───────┘                │
│         │                 │                          │
└─────────┼─────────────────┼──────────────────────────┘
          │                 │
          ▼                 ▼
    ┌──────────┐     ┌─────────────┐
    │OpenRouter│     │   Ollama    │
    │   API    │     │localhost:   │
    │          │     │   11434     │
    └──────────┘     └─────────────┘
```

## Benefits Summary

### Why Ollama?
- ✅ **Free forever** - No API costs
- ✅ **Private** - Data never leaves your computer
- ✅ **Fast** - No network latency
- ✅ **Offline** - Works without internet
- ✅ **Unlimited** - No rate limits or quotas

### Why OpenRouter?
- ✅ **Easy setup** - Just an API key
- ✅ **Multiple models** - Access to GPT-4, Claude, etc.
- ✅ **No hardware** - Runs in cloud
- ✅ **Always available** - No local installation

### Best of Both Worlds
Switch between them based on your needs:
- Development/Testing → Ollama (free)
- Production/Quality → OpenRouter (better models)
- Private data → Ollama (stays local)
- Complex tasks → OpenRouter (GPT-4)

## Resources

- **Setup Guide**: See `OLLAMA_SETUP.md`
- **Implementation Details**: See `OLLAMA_INTEGRATION_SUMMARY.md`
- **Ollama Website**: https://ollama.ai
- **Ollama GitHub**: https://github.com/ollama/ollama
- **OpenRouter**: https://openrouter.ai

## Support

For issues:
1. Check `OLLAMA_SETUP.md` troubleshooting section
2. Verify Ollama is running: `ollama ps`
3. Test connection in settings UI
4. Check Ollama logs: `journalctl -u ollama` (Linux)

---

**Quick Start**: Install Ollama → Pull llama3 → Configure in Settings → Done! 🎉
