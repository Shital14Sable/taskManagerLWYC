// BYOK (bring-your-own-key) LLM integration. The API key lives in
// localStorage only — never in UserPreferences — so it's never synced to the
// user's Google Drive/GitHub backup. Calls go straight from the browser to
// the provider using the user's own key, so there's no server-side cost to us.

const STORAGE_KEY = 'trackmind_llm_config'
const RULES_STORAGE_KEY = 'trackmind_llm_rules'

export function getLLMRules(): string {
  return localStorage.getItem(RULES_STORAGE_KEY) ?? ''
}

export function saveLLMRules(rules: string): void {
  if (rules.trim()) {
    localStorage.setItem(RULES_STORAGE_KEY, rules)
  } else {
    localStorage.removeItem(RULES_STORAGE_KEY)
  }
}

export type LLMProvider = 'anthropic' | 'openai' | 'ollama'

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-3-5-haiku-20241022',
  openai: 'gpt-4o-mini',
  ollama: 'llama3.1',
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama (Local)',
}

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  model: string
  host?: string  // Ollama only; default: http://localhost:11434
}

export function getLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const provider: LLMProvider =
      parsed.provider === 'openai' ? 'openai' :
      parsed.provider === 'ollama' ? 'ollama' :
      'anthropic'
    // Ollama doesn't require an API key
    if (provider !== 'ollama' && !parsed?.apiKey) return null
    return {
      provider,
      apiKey: parsed.apiKey ?? '',
      model: parsed.model || DEFAULT_MODELS[provider],
      host: parsed.host,
    }
  } catch {
    return null
  }
}

export function saveLLMConfig(
  provider: LLMProvider,
  apiKey: string,
  model: string = DEFAULT_MODELS[provider],
  host?: string
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, apiKey, model, host }))
}

export function clearLLMConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export interface SuggestedTask {
  title: string
  description?: string
  estimated_minutes?: number
  priority?: number
}

function buildPrompt(
  input: { projectName: string; projectDescription?: string | null; deadline?: string | null },
  rules?: string
): string {
  return [
    `Break the following project down into 5-10 concrete, actionable tasks.`,
    `Project: ${input.projectName}`,
    input.projectDescription ? `Description: ${input.projectDescription}` : '',
    input.deadline ? `Deadline: ${input.deadline}` : '',
    rules?.trim() ? `\nAdditional rules — always follow these:\n${rules.trim()}` : '',
    '',
    'Respond with ONLY a JSON array (no markdown, no prose, no code fences) of objects shaped exactly like:',
    '[{"title": string, "description": string, "estimated_minutes": number, "priority": number}]',
    'priority is 1-5 where 5 is highest.',
  ].filter(Boolean).join('\n')
}

async function callAnthropic(config: LLMConfig, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Anthropic API key.')
    }
    const text = await response.text().catch(() => '')
    throw new Error(`Anthropic API error (${response.status}): ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  return data?.content?.[0]?.text ?? ''
}

async function callOpenAI(config: LLMConfig, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid OpenAI API key.')
    }
    const text = await response.text().catch(() => '')
    throw new Error(`OpenAI API error (${response.status}): ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

async function callOllama(config: LLMConfig, prompt: string): Promise<string> {
  const host = (config.host || 'http://localhost:11434').replace(/\/$/, '')
  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Model "${config.model}" not found in Ollama. Run: ollama pull ${config.model}`)
    }
    const text = await response.text().catch(() => '')
    throw new Error(`Ollama error (${response.status}): ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  return data?.message?.content ?? ''
}

export async function suggestTaskBreakdown(input: {
  projectName: string
  projectDescription?: string | null
  deadline?: string | null
}): Promise<SuggestedTask[]> {
  const config = getLLMConfig()
  if (!config) {
    throw new Error('No AI provider configured. Add one in Settings → AI.')
  }

  const rules = getLLMRules()
  const prompt = buildPrompt(input, rules || undefined)
  const text =
    config.provider === 'openai' ? await callOpenAI(config, prompt) :
    config.provider === 'ollama' ? await callOllama(config, prompt) :
    await callAnthropic(config, prompt)

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Could not parse task suggestions from the AI response.')
  }

  const parsed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed)) {
    throw new Error('Unexpected response format from AI.')
  }

  return parsed
    .filter((t): t is Record<string, unknown> => !!t && typeof t.title === 'string' && t.title.trim().length > 0)
    .map((t) => ({
      title: String(t.title).trim(),
      description: typeof t.description === 'string' ? t.description : undefined,
      estimated_minutes: typeof t.estimated_minutes === 'number' ? t.estimated_minutes : undefined,
      priority: typeof t.priority === 'number' ? Math.min(5, Math.max(1, Math.round(t.priority))) : undefined,
    }))
}

export { PROVIDER_LABELS, DEFAULT_MODELS }
