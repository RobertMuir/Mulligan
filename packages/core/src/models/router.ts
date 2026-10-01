import { estimateCapability, estimateCost, isLocal } from './catalog.js';
import { assessDifficulty, formatDifficulty, type DifficultyAssessment } from './difficulty.js';
import { createProvider, isProviderReady, type ProviderFactory } from './providers/index.js';
import {
  AGENT_ROLES,
  type AgentRole,
  type ModelProvider,
  type ModelRouter,
  type ModelsConfig,
  type ProviderConfig,
  type TaskContext,
} from './types.js';

export class ModelRoutingError extends Error {
  override name = 'ModelRoutingError';
}

export interface RoutingDecision {
  provider: string;
  mode: 'manual' | 'auto' | 'pinned';
  difficulty?: DifficultyAssessment;
  reason: string;
}

export interface CandidateModel {
  name: string;
  config: ProviderConfig;
  capability: number;
  cost: number;
  local: boolean;
}

/**
 * Routes each agent role to a model.
 *
 * - manual: the developer's role assignments decide (spec §28); unassigned
 *   roles fall back to `default`, which gives single-model mode.
 * - auto: the task's difficulty decides. Mulligan picks the cheapest ready
 *   model whose capability meets the task's tier, escalating as Mulligan
 *   are taken. Pinned roles keep their manual assignment.
 */
export class ConfiguredModelRouter implements ModelRouter {
  private readonly cache = new Map<string, ModelProvider>();

  constructor(
    private readonly config: ModelsConfig,
    private readonly factory: ProviderFactory = createProvider,
    private readonly ready: (config: ProviderConfig) => boolean = isProviderReady,
  ) {}

  get mode(): 'manual' | 'auto' {
    return this.config.routing?.mode ?? 'manual';
  }

  async selectModel(role: AgentRole, task: TaskContext = { description: '' }): Promise<ModelProvider> {
    return this.provider(this.decide(role, task).provider);
  }

  /** The routing decision with its reasoning, without creating the provider. */
  decide(role: AgentRole, task: TaskContext = { description: '' }): RoutingDecision {
    const routing = this.config.routing;
    const manual = this.providerNameFor(role);
    if (routing?.mode !== 'auto') {
      if (!manual) {
        throw new ModelRoutingError(
          `No model is assigned to the "${role}" role and no default is set. Configure models in .mulligan/config.yaml.`,
        );
      }
      return { provider: manual, mode: 'manual', reason: `${role} is assigned to ${manual}` };
    }
    const pinned = routing.pinned?.includes(role) ? this.config.roles?.[role] : undefined;
    if (pinned) return { provider: pinned, mode: 'pinned', reason: `${role} is pinned to ${pinned}` };

    const difficulty = assessDifficulty(task, role, routing.weights);
    const pool = this.candidates();
    const capable = pool.filter((c) => c.capability >= difficulty.tier);
    // Capable models: cheapest first (local first if preferred). Otherwise: the most capable there is.
    const [chosen] = capable.length
      ? [...capable].sort(
          (a, b) =>
            (routing.preferLocal ? Number(b.local) - Number(a.local) : 0) ||
            a.cost - b.cost ||
            a.capability - b.capability ||
            a.name.localeCompare(b.name),
        )
      : [...pool].sort((a, b) => b.capability - a.capability || a.cost - b.cost);
    if (!chosen) {
      if (manual) return { provider: manual, mode: 'manual', difficulty, reason: `no ready models for auto routing; using ${manual}` };
      throw new ModelRoutingError('Auto routing found no ready models. Check API keys or start a local model server.');
    }
    const fit = capable.length
      ? `cheapest${routing.preferLocal ? ' (local first)' : ''} model with capability ≥ ${difficulty.tier}`
      : `no model reaches tier ${difficulty.tier}; using the most capable available`;
    return {
      provider: chosen.name,
      mode: 'auto',
      difficulty,
      reason: `${formatDifficulty(difficulty)} → ${chosen.name} (capability ${chosen.capability}, cost ${chosen.cost}): ${fit}`,
    };
  }

  /** Ready providers auto routing may choose from, with capability and cost. */
  candidates(): CandidateModel[] {
    const names = this.config.routing?.pool ?? Object.keys(this.config.providers);
    return names.flatMap((name) => {
      const config = this.config.providers[name];
      if (!config || !this.ready(config)) return [];
      return [{ name, config, capability: estimateCapability(config), cost: estimateCost(config), local: isLocal(config) }];
    });
  }

  provider(name: string): ModelProvider {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const providerConfig = this.config.providers[name];
    if (!providerConfig) {
      throw new ModelRoutingError(`Model "${name}" is referenced but not defined under models.providers.`);
    }
    const provider = this.factory(name, providerConfig);
    this.cache.set(name, provider);
    return provider;
  }

  providerNameFor(role: AgentRole): string | undefined {
    return this.config.roles?.[role] ?? this.config.default;
  }

  /** Role → provider name, for display. Roles with no model are absent. */
  assignments(): Partial<Record<AgentRole, string>> {
    const out: Partial<Record<AgentRole, string>> = {};
    for (const role of AGENT_ROLES) {
      const name = this.providerNameFor(role);
      if (name) out[role] = name;
    }
    return out;
  }

  isSingleModel(): boolean {
    if (this.mode === 'auto') return this.candidates().length <= 1;
    return new Set(Object.values(this.assignments()).filter(Boolean)).size <= 1;
  }
}
