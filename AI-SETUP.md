# AI copy — setup

Owner-only. The AI layer writes product copy (title, short + long description,
bullets, keywords, meta description). It never invents specifications: it only
rewrites the facts you supply, and every response is validated before it is
returned. Responses that make delivery, stock-location, authenticity, warranty,
or guarantee claims are rejected (502), never saved.

## Configure

Set privately in Render Environment (never in version control or chat):

```sh
AI_API_KEY=           # Groq key (free tier) or OpenAI key
AI_BASE_URL=https://api.groq.com/openai/v1   # OpenAI: https://api.openai.com/v1
AI_MODEL=llama-3.1-8b-instant                 # OpenAI: gpt-4o-mini
```

No key configured: `POST /api/ai/describe` returns 503 with an honest
not-configured message. Nothing is faked.

## Endpoints (owner login required)

- `GET /api/ai/status` → `{configured, model}`
- `POST /api/ai/describe` with `{name, brand, category, specs[]}` →
  `{title, shortDescription, longDescription, bullets[], keywords[],
  metaDescription, source: 'ai', model}`

`specs` is a string array of supplier facts (materials, sizes, notes). The
prompt forbids the model from using anything else. Keep a human-review step
before publishing AI copy on real listings.

## Cost notes (per prior research)

- Groq free tier covers launch volume; paid Llama 3.1 8B ≈ $0.05 in /
  $0.08 out per 1M tokens (~10,000 descriptions under $1).
- OpenAI `gpt-4o-mini` ≈ $0.15 in / $0.60 out per 1M tokens.

## What AI does NOT do here

- It does not set prices. The deterministic engine in `pricing.mjs`
  (`POST /api/pricing/preview`) sets final prices; an LLM may suggest a band
  only.
- It does not answer customer support or score trends in this branch.
- It does not invent specs, stock, delivery dates, or tracking numbers.
