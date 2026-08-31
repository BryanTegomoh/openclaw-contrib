import { normalizeSortedUniqueTrimmedStringList } from "@openclaw/normalization-core/string-normalization";
import type { AgentsListResult } from "../../api/types.ts";
import type { ApplicationContext } from "../../app/context.ts";
import { listSelectableAgents } from "../../lib/agents/display.ts";
import { currentConfigObject } from "../../lib/config/config-state-model.ts";
import {
  getCronJobPayload,
  resolveConfiguredCronModelSuggestions,
  type CronState,
} from "../../lib/cron/index.ts";
import { resolveCronTimezoneSuggestions } from "./timezone-suggestions.ts";

export const THINKING_SUGGESTIONS = ["off", "minimal", "low", "medium", "high"];

export function buildCronSuggestions(params: {
  channels: ApplicationContext["channels"]["state"];
  runtimeConfig: ApplicationContext["runtimeConfig"]["state"];
  cron: CronState;
  agentsList: AgentsListResult | null;
  modelSuggestions: string[];
}) {
  const configValue = currentConfigObject(params.runtimeConfig);
  const channel = params.cron.cronForm.deliveryChannel.trim() || "last";
  const systemAgentIds = new Set(
    (params.agentsList?.agents ?? [])
      .filter((entry) => entry.kind === "system")
      .map((entry) => entry.id.trim()),
  );
  const agentSuggestions = normalizeSortedUniqueTrimmedStringList([
    ...listSelectableAgents(params.agentsList?.agents ?? []).map((entry) => entry.id.trim()),
    ...params.cron.cronJobs.map((job) =>
      typeof job.agentId === "string" && !systemAgentIds.has(job.agentId.trim())
        ? job.agentId.trim()
        : "",
    ),
  ]);
  const modelSuggestions = normalizeSortedUniqueTrimmedStringList([
    ...params.modelSuggestions,
    ...resolveConfiguredCronModelSuggestions(configValue),
    ...params.cron.cronJobs.map((job) => {
      const payload = getCronJobPayload(job);
      return payload?.kind === "agentTurn" && typeof payload.model === "string"
        ? payload.model.trim()
        : "";
    }),
  ]);
  const accountTargetsByChannel = new Map(
    Object.entries(params.channels.channelsSnapshot?.channelAccounts ?? {}).map(
      ([channelId, accounts]) => [
        channelId,
        accounts
          .flatMap((account) => [account.accountId, account.name])
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean),
      ],
    ),
  );
  const allAccountTargets = [...accountTargetsByChannel.values()].flat();
  const accountTargets =
    channel === "last" ? allAccountTargets : (accountTargetsByChannel.get(channel) ?? []);
  const accountTargetSetsByChannel = new Map(
    [...accountTargetsByChannel].map(([channelId, targets]) => [channelId, new Set(targets)]),
  );
  const allAccountTargetSet = new Set(allAccountTargets);
  const accountTargetSet = new Set(accountTargets);
  const deliveryTargets = normalizeSortedUniqueTrimmedStringList(
    params.cron.cronJobs.map((job) => {
      const target = typeof job.delivery?.to === "string" ? job.delivery.to.trim() : "";
      const deliveryChannel = job.delivery?.channel?.trim() || "last";
      const deliveryAccountTargetSet =
        deliveryChannel === "last"
          ? allAccountTargetSet
          : accountTargetSetsByChannel.get(deliveryChannel);
      return accountTargetSet.has(target) || deliveryAccountTargetSet?.has(target) ? "" : target;
    }),
  );
  return {
    agentSuggestions,
    modelSuggestions,
    timezoneSuggestions: resolveCronTimezoneSuggestions(params.cron.cronJobs),
    accountTargets,
    deliveryToSuggestions:
      params.cron.cronForm.deliveryMode === "webhook"
        ? deliveryTargets.filter((value) => /^https?:\/\//i.test(value))
        : deliveryTargets,
  };
}
