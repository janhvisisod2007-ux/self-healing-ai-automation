# 🛠️ Self-Healing AI Automation System

Built for **Code E Fiesta 2026** (Problem Statement 4).

**Live demo:** https://self-healing-ai-automation.onrender.com/

## Problem
Business automations (order → invoice → email → CRM) break when data changes shape: a field gets renamed, a value has the wrong type, required data goes missing. Today an engineer reads logs, finds the cause, patches the payload and reruns it. That is slow and costly.

## Solution
An AI agent that watches the workflow and repairs it:

1. **Detect:** a step fails and the error is captured.
2. **Diagnose:** the LLM reads the error and payload and explains the root cause.
3. **Fix:** the LLM proposes a corrected payload.
4. **Validate:** the fix is checked against a schema before it is used.
5. **Retry:** the failed step is rerun. Safe fixes apply automatically; risky ones wait for human approval.

The AI never invents missing data (e.g. a customer's email). In that case it escalates to a human.

## Features
- 4-step simulated workflow with real CRM writes (saved to a file)
- Failure injection: renamed field, wrong data type, missing email
- Editable custom order to break the data yourself
- Auto-heal mode and human approval flow
- "What happened" timeline with a before/after payload diff
- Failure history with recovery time
- Rule-based fallback if the LLM is unavailable

## Tech stack
Node.js, Express, vanilla HTML/CSS/JS, Groq API (`openai/gpt-oss-20b`)

## Run locally
```bash
git clone https://github.com/TUMHARA_USERNAME/self-healing-ai-automation.git
cd self-healing-ai-automation
npm install
```
Create a `.env` file (see `.env.example`):
```
GROQ_API_KEY=your_key
GROQ_MODEL=openai/gpt-oss-20b
```
```bash
npm start
```
Open http://localhost:3000

## Demo flow
1. **Normal order:** everything passes.
2. **Field renamed:** AI finds `phone_no` vs `phone`, fixes it automatically.
3. **Wrong data type:** AI converts `"500 rupees"` to `500`.
4. **Missing email:** AI refuses to guess and escalates to a human.

## Future work
Real integrations (email, CRM APIs), persistent failure memory in a database, retry with backoff for timeouts, and learning from past fixes.
