import { describe, expect, it } from "vitest";
import type { CronJob } from "../../api/types.ts";
import type { ApplicationContext } from "../../app/context.ts";
import { createInitialCronState } from "../../lib/cron/index.ts";
import { buildCronSuggestions } from "./form-suggestions.ts";

describe("buildCronSuggestions", () => {
  it("keeps channel account identities out of recipient suggestions", () => {
    const cron = createInitialCronState();
    cron.cronForm.deliveryMode = "announce";
    cron.cronForm.deliveryChannel = "telegram";
    const job = {
      id: "nightly",
      name: "Nightly",
      enabled: true,
      createdAtMs: 0,
      updatedAtMs: 0,
      schedule: { kind: "every", everyMs: 60_000 },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "summarize" },
      delivery: { mode: "announce", channel: "telegram", to: "-100123" },
      state: {},
    } satisfies CronJob;
    cron.cronJobs = [
      job,
      {
        ...job,
        id: "legacy-account-target",
        name: "Legacy account target",
        delivery: { ...job.delivery, to: "gmail-cleaner" },
      },
    ];
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
});
