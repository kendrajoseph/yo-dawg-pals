## Plan: Switch assistant-chat to Anthropic Claude Haiku 4.5

### Steps
1. **Add `ANTHROPIC_API_KEY` secret** via the secrets tool — user will paste the value into the secure form.
2. **Replace `supabase/functions/assistant-chat/index.ts`** with the contents of the uploaded `03-assistant-chat-ANTHROPIC.ts` file (all 342 lines), which:
   - Calls `https://api.anthropic.com/v1/messages` directly with `claude-haiku-4-5`
   - Uses Anthropic's request/response format (system as separate field, tool_use/tool_result content blocks)
   - Keeps the existing `_shared/assistant-tools.ts` tool definitions and execution
   - Preserves conversation persistence and the `MAX_TOOL_ITERATIONS = 8` agent loop
3. **Auto-deploy** — the edge function deploys automatically on save.
4. **Verify** by sending a test message from the assistant UI on `/sitter`.

### Notes
- No DB migrations, no client changes required.
- `_shared/assistant-tools.ts` stays as-is.
- Bypasses Lovable AI Gateway — billed directly to your Anthropic account.