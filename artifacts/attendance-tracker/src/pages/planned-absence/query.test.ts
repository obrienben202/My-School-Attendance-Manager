import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { plannedAbsenceQuery } from "./query.ts";

test("switching identities on one client never renders another user's planned absences", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const alice = [{ id: 1, learnerName: "Alice's request" }];
  const bob = [{ id: 2, learnerName: "Bob's request" }];
  let resolveBob!: (rows: typeof bob) => void;
  const fetchForUser = (userId: string | undefined) => () =>
    userId === "alice" ? Promise.resolve(alice) : new Promise<typeof bob>((resolve) => { resolveBob = resolve; });
  const options = (userId: string | undefined) => ({
    ...plannedAbsenceQuery(userId),
    queryFn: fetchForUser(userId),
  });

  client.setQueryData(plannedAbsenceQuery("alice").queryKey, alice);
  const observer = new QueryObserver(client, options("alice"));
  const rendered: (typeof alice | undefined)[] = [];
  const unsubscribe = observer.subscribe((result) => { rendered.push(result.data); });
  try {
    assert.deepEqual(observer.getCurrentResult().data, alice);
    const beforeBob = rendered.length;
    observer.setOptions(options("bob"));
    assert.equal(observer.getCurrentResult().data, undefined);
    assert.equal(observer.getCurrentResult().isLoading, true);
    assert.ok(rendered.slice(beforeBob).every((rows) => !rows?.some((row) => row.id === alice[0].id)));

    resolveBob(bob);
    await client.getQueryCache().find({ queryKey: plannedAbsenceQuery("bob").queryKey })?.promise;
    assert.deepEqual(observer.getCurrentResult().data, bob);

    observer.setOptions(options(undefined));
    assert.equal(observer.getCurrentResult().data, undefined);
    assert.equal(observer.getCurrentResult().fetchStatus, "idle");

    observer.setOptions(options("alice"));
    assert.deepEqual(observer.getCurrentResult().data, alice);
  } finally {
    unsubscribe();
    client.clear();
  }
});