import { vi } from "vitest";

function createChainableMock() {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};

  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "is",
    "like",
    "ilike",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
  ];

  for (const method of methods) {
    mock[method] = vi.fn().mockReturnValue(mock);
  }

  return mock;
}

export function createMockSupabase() {
  const chainable = createChainableMock();

  const supabase = {
    from: vi.fn().mockReturnValue(chainable),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    __chain: chainable,
  };

  return supabase;
}

export function mockSupabaseResponse(
  chain: Record<string, ReturnType<typeof vi.fn>>,
  response: { data?: unknown; error?: { message: string; code?: string } | null; count?: number }
) {
  const terminalMethods = ["select", "single", "maybeSingle", "insert", "update", "upsert", "delete", "eq", "order", "limit"];
  for (const method of terminalMethods) {
    if (chain[method]) {
      chain[method].mockReturnValue({
        ...chain,
        then: (resolve: (value: unknown) => void) => resolve(response),
        data: response.data ?? null,
        error: response.error ?? null,
        count: response.count,
      });
    }
  }
}

export function setMockUser(supabaseMock: ReturnType<typeof createMockSupabase>, userId: string) {
  supabaseMock.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  });
}

export function setNoUser(supabaseMock: ReturnType<typeof createMockSupabase>) {
  supabaseMock.auth.getUser.mockResolvedValue({
    data: { user: null },
  });
}
