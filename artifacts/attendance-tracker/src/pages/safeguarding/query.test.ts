import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { safeguardingNotesOptions } from "./query.ts";

test("open safeguarding pages refresh on a visible interval and when staff return", async () => {
  const options = safeguardingNotesOptions("reader", "staff");
  assert.equal(options.query.refetchInterval, 15_000);
  assert.equal(options.query.refetchIntervalInBackground, false);
  assert.equal(options.query.refetchOnWindowFocus, "always");
  assert.equal(options.query.refetchOnReconnect, "always");
  assert.equal(options.query.refetchOnMount, "always");
  assert.equal(options.query.staleTime, 0);
  assert.equal(options.request.cache, "no-store");

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let saved = [{ id: 1, content: "Existing synthetic note" }];
  const observer = new QueryObserver(client, {
    ...options.query,
    queryFn: async () => [...saved],
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    saved = [...saved, { id: 2, content: "Another staff member's synthetic note" }];
    // Exercise the query refetch used by the interval without a navigation.
    await observer.refetch();
    assert.deepEqual(observer.getCurrentResult().data, saved);
    saved = [...saved, { id: 3, content: "The reader's saved reply" }];
    await client.invalidateQueries({ queryKey: ["/api/safeguarding/notes"] });
    assert.deepEqual(observer.getCurrentResult().data, saved);
  } finally {
    unsubscribe();
    client.clear();
  }
});

test("identity and role changes isolate notes and discard the inactive cache", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const staff = safeguardingNotesOptions("reader", "staff").query;
  const hod = safeguardingNotesOptions("reader", "hod").query;
  const other = safeguardingNotesOptions("other", "staff").query;
  assert.notDeepEqual(staff.queryKey, hod.queryKey);
  assert.notDeepEqual(staff.queryKey, other.queryKey);

  let resolveOld!: (rows: string[]) => void;
  const observer = new QueryObserver(client, {
    ...staff,
    queryFn: () => new Promise<string[]>((resolve) => { resolveOld = resolve; }),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const oldRequest = client.getQueryCache().find({ queryKey: staff.queryKey })?.promise;
    observer.setOptions({ ...hod, queryFn: async () => ["New role's notes"] });
    assert.equal(observer.getCurrentResult().data, undefined);
    resolveOld(["Old role's notes"]);
    await oldRequest;
    await client.getQueryCache().find({ queryKey: hod.queryKey })?.promise;
    assert.deepEqual(observer.getCurrentResult().data, ["New role's notes"]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(client.getQueryData(staff.queryKey), undefined);
  } finally {
    unsubscribe(); // Same cache lifecycle as sign-out/unmount.
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(client.getQueryData(hod.queryKey), undefined);
    client.clear();
  }
});
