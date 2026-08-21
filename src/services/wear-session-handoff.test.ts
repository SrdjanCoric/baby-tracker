import { describe, expect, it, vi } from "vitest";

import {
  createWearSessionPublisher,
  createWearSessionRefreshHandler,
} from "./wear-session-handoff";

describe("Wear session handoff", () => {
  it("binds active and invalidated state to the current phone install", async () => {
    const published: Array<Record<string, unknown>> = [];
    let revision = -1;
    const options = {
      bridge: {
        publishState: async (envelopeJson: string) => {
          published.push(JSON.parse(envelopeJson));
        },
      },
      revisionStore: {
        read: async () => revision,
        write: async (next: number) => {
          revision = next;
        },
      },
      epochProvider: async () => "phone-install-2",
    };
    const publisher = createWearSessionPublisher(options);

    await publisher.publishActive({
      account: { id: "user-1", label: "Alex" },
      baby: { id: "baby-1", name: "Sofi", timezone: "Europe/Belgrade" },
      supabase: { url: "https://project.supabase.co", anonKey: "anon-key" },
      accessToken: "access-token",
      expiresAt: 1_800_000_000,
    });
    await publisher.publishInvalidated("signed-out");

    expect(published.map(({ phoneEpoch }) => phoneEpoch)).toEqual([
      "phone-install-2",
      "phone-install-2",
    ]);
  });

  it("publishes only the current access token and selected identity", async () => {
    const publishState = vi.fn<(envelopeJson: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    let revision = 40;
    const publisher = createWearSessionPublisher({
      bridge: { publishState },
      epochProvider: async () => "phone-install-1",
      revisionStore: {
        read: async () => revision,
        write: async (next) => {
          revision = next;
        },
      },
    });

    await publisher.publishActive({
      account: { id: "user-1", label: "Alex" },
      baby: {
        id: "baby-1",
        name: "Sofi",
        timezone: "Europe/Belgrade",
      },
      supabase: {
        url: "https://project.supabase.co",
        anonKey: "anon-key",
      },
      accessToken: "access-token",
      expiresAt: 1_800_000_000,
    });

    const envelope = JSON.parse(publishState.mock.calls[0][0]);
    expect(envelope).toEqual({
      version: 1,
      phoneEpoch: "phone-install-1",
      revision: 41,
      disposition: "active",
      account: { id: "user-1", label: "Alex" },
      baby: {
        id: "baby-1",
        name: "Sofi",
        timezone: "Europe/Belgrade",
      },
      supabase: {
        url: "https://project.supabase.co",
        anonKey: "anon-key",
      },
      accessToken: "access-token",
      expiresAt: 1_800_000_000,
    });
    expect(JSON.stringify(envelope)).not.toContain("refresh");
  });

  it("supersedes the active credential with a versioned invalidation", async () => {
    const published: Array<Record<string, unknown>> = [];
    let revision = 7;
    const publisher = createWearSessionPublisher({
      epochProvider: async () => "phone-install-1",
      bridge: {
        publishState: async (envelopeJson) => {
          published.push(JSON.parse(envelopeJson));
        },
      },
      revisionStore: {
        read: async () => revision,
        write: async (next) => {
          revision = next;
        },
      },
    });

    await publisher.publishInvalidated("signed-out");

    expect(published).toEqual([
      {
        version: 1,
        phoneEpoch: "phone-install-1",
        revision: 8,
        disposition: "invalidated",
        reason: "signed-out",
      },
    ]);
  });

  it("serializes concurrent publications so revisions never collide", async () => {
    const revisions: number[] = [];
    let revision = 0;
    const publisher = createWearSessionPublisher({
      epochProvider: async () => "phone-install-1",
      bridge: {
        publishState: async (envelopeJson) => {
          revisions.push(JSON.parse(envelopeJson).revision);
        },
      },
      revisionStore: {
        read: async () => revision,
        write: async (next) => {
          await Promise.resolve();
          revision = next;
        },
      },
    });

    await Promise.all([
      publisher.publishInvalidated("signed-out"),
      publisher.publishInvalidated("account-switched"),
    ]);

    expect(revisions).toEqual([1, 2]);
  });

  it("asks the phone to refresh once for each newer watch request", async () => {
    const refreshSession = vi.fn(async () => undefined);
    const handleRefreshRequest = createWearSessionRefreshHandler(refreshSession);

    await handleRefreshRequest(3);
    await handleRefreshRequest(3);
    await handleRefreshRequest(2);
    await handleRefreshRequest(4);

    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it("retries a failed request and persists successful request deduplication", async () => {
    let handledRevision = 2;
    const handledStore = {
      read: async () => handledRevision,
      write: async (revision: number) => {
        handledRevision = revision;
      },
    };
    const refreshSession = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const firstProcess = createWearSessionRefreshHandler(
      refreshSession,
      handledStore
    );

    await expect(firstProcess(3)).rejects.toThrow("offline");
    await firstProcess(3);

    const nextProcess = createWearSessionRefreshHandler(
      refreshSession,
      handledStore
    );
    await nextProcess(3);
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });
});
