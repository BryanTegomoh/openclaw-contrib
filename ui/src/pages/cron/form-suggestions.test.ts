import { describe, expect, it } from "vitest";
import type { CronJob } from "../../api/types.ts";
import type { ApplicationContext } from "../../app/context.ts";
import { createInitialCronState } from "../../lib/cron/index.ts";
import { buildCronSuggestions } from "./form-suggestions.ts";

function cronJob(id: string, channel: string, to: string): CronJob {
  return {
    id,
    name: id,
    enabled: true,
    createdAtMs: 0,
    updatedAtMs: 0,
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "summarize" },
    delivery: { mode: "announce", channel, to },
    state: {},
  } satisfies CronJob;
}

describe("buildCronSuggestions", () => {
  it("keeps channel account identities out of recipient suggestions", () => {
    const cron = createInitialCronState();
    cron.cronForm.deliveryMode = "announce";
    cron.cronForm.deliveryChannel = "telegram";
    const job = cronJob("nightly", "telegram", "-100123");
    cron.cronJobs = [job, cronJob("legacy-account-target", "telegram", "gmail-cleaner")];
    const channels = {
      channelsSnapshot: {
        channelAccounts: {
          telegram: [{ accountId: "default", name: "gmail-cleaner" }],
        },
      },
    } as unknown as ApplicationContext["channels"]["state"];
    const runtimeConfig = {
      configSnapshot: null,
    } as ApplicationContext["runtimeConfig"]["state"];

    const suggestions = buildCronSuggestions({
      channels,
      runtimeConfig,
      cron,
      agentsList: null,
      modelSuggestions: [],
    });

    expect(suggestions.accountTargets).toEqual(["default", "gmail-cleaner"]);
    expect(suggestions.deliveryToSuggestions).toEqual(["-100123"]);
  });

  it("filters saved account identities using their delivery channels", () => {
    const cron = createInitialCronState();
    cron.cronForm.deliveryMode = "announce";
    cron.cronForm.deliveryChannel = "discord";
    cron.cronJobs = [
      cronJob("valid-telegram", "telegram", "-100123"),
      cronJob("legacy-telegram-account", "telegram", "gmail-cleaner"),
      cronJob("valid-discord", "discord", "team-room"),
    ];
    const channels = {
      channelsSnapshot: {
        channelAccounts: {
          discord: [{ accountId: "primary", name: "alerts" }],
          telegram: [{ accountId: "default", name: "gmail-cleaner" }],
        },
      },
    } as unknown as ApplicationContext["channels"]["state"];
    const runtimeConfig = {
      configSnapshot: null,
    } as ApplicationContext["runtimeConfig"]["state"];

    const suggestions = buildCronSuggestions({
      channels,
      runtimeConfig,
      cron,
      agentsList: null,
      modelSuggestions: [],
    });

    expect(suggestions.accountTargets).toEqual(["primary", "alerts"]);
    expect(suggestions.deliveryToSuggestions).toEqual(["-100123", "team-room"]);
  });
});
