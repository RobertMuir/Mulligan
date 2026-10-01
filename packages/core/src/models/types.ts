export const AGENT_ROLES = [
  'architect',
  'implementer',
  'reviewer',
  'verifier',
  'teacher',
  'technical-writer',
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const PROVIDER_KINDS = [
  'anthropic',
  'openai',
  'gemini',
  'openrouter',
  'mistral',
  'groq',
  'together',
  'deepseek',
  'xai',
  'fireworks',
  'ollama',
  'llamacpp',
  'lmstudio',
  'vllm',
  'openai-compatible',
] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const isAgentRole = (value: unknown): value is AgentRole => AGENT_ROLES.some((r) => r === value);
export const isProviderKind = (value: unknown): value is ProviderKind => PROVIDER_KINDS.some((k) => k === value);

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  provider: ProviderKind;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface ModelProvider {
  /** The name the user gave this provider in config, e.g. "claude". */
  readonly name: string;
  readonly kind: ProviderKind;
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export interface TaskContext {
  description: string;
  files?: string[];
  /** Approximate size of the change, when known. */
  linesChanged?: number;
  safetyMode?: boolean;
  /** Mulligan already taken on this task. Each one is evidence it is harder than it looked. */
  attempts?: number;
}

/** Spec §28. */
export interface ModelRouter {
  selectModel(role: AgentRole, task: TaskContext): Promise<ModelProvider>;
}

export interface ProviderConfig {
  kind: ProviderKind;
  model: string;
  /** Environment variable holding the API key. Keys never live in config files. */
  apiKeyEnv?: string;
  baseUrl?: string;
  /** 1–5. Overrides the built-in estimate used by automatic routing. */
  capability?: number;
  /** 0–5 relative cost. Overrides the built-in estimate (local models default to 0). */
  cost?: number;
  /** Treat as a local model (no key required, no data leaves the machine). */
  local?: boolean;
}

export interface RoutingConfig {
  /** `manual`: role assignments decide. `auto`: task difficulty decides. */
  mode: 'manual' | 'auto';
  /** Roles that keep their manual assignment even in auto mode. */
  pinned?: AgentRole[];
  /** Providers auto mode may choose from. Defaults to every ready provider. */
  pool?: string[];
  /** Prefer local models whenever they are capable enough. */
  preferLocal?: boolean;
  /** Overrides for difficulty factor weights (see DEFAULT_DIFFICULTY_WEIGHTS). */
  weights?: Partial<Record<string, number>>;
}

export interface ModelsConfig {
  providers: Record<string, ProviderConfig>;
  /** Role → provider name. Unassigned roles fall back to `default`. */
  roles?: Partial<Record<AgentRole, string>>;
  /** Single-model mode: only `default` is set. */
  default?: string;
  routing?: RoutingConfig;
}
