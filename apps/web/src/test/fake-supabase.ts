/**
 * Minimal stand-in for the Supabase client in agent tests: every query on a table resolves to the
 * rows given for it (filters are recorded, not applied), and RPC calls are recorded.
 */
export function fakeSupabase(tables: Record<string, Record<string, unknown>[]>, rpcResult: unknown = ["00000000-0000-4000-8000-0000000000aa"]) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const queries: { table: string; filters: unknown[][] }[] = [];
  const from = (table: string) => {
    const rows = tables[table] ?? [];
    const q = { table, filters: [] as unknown[][] };
    queries.push(q);
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "in", "ilike", "or", "not", "is", "gte", "lte", "lt", "order", "limit"]) {
      builder[m] = (...args: unknown[]) => { q.filters.push([m, ...args]); return builder; };
    }
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    builder.single = builder.maybeSingle;
    builder.then = (ok: (v: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(ok);
    return builder;
  };
  const client = {
    from,
    rpc: (name: string, args: Record<string, unknown>) => { rpcCalls.push({ name, args }); return Promise.resolve({ data: rpcResult, error: null }); },
  };
  return { client: client as never, rpcCalls, queries };
}
