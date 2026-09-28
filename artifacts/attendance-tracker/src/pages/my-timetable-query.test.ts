import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { myTimetableQuery, type PersonalSlot } from "./my-timetable-query.ts";

test("switching accounts on one query client never shows the previous account's sessions", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const aliceSlot: PersonalSlot = {
    id: 1, day: "Monday", startTime: "09:00", endTime: "10:00",
    description: "Alice's session", groupLabel: null, room: null,
  };
  const bobSlot: PersonalSlot = { ...aliceSlot, id: 2, description: "Bob's session" };
  const originalFetch = globalThis.fetch;
  try {
    let resolveBob!: (response: Response) => void;
    globalThis.fetch = async () => new Promise<Response>(resolve => { resolveBob = resolve; });
    client.setQueryData(myTimetableQuery("alice", true).queryKey, [aliceSlot]);
    const observer = new QueryObserver(client, myTimetableQuery("alice", true));
    const unsubscribe = observer.subscribe(() => {});
    try {
      assert.deepEqual(observer.getCurrentResult().data, [aliceSlot]);

      observer.setOptions(myTimetableQuery("bob", true));
      assert.equal(observer.getCurrentResult().data, undefined);
      assert.equal(observer.getCurrentResult().isLoading, true);
      resolveBob(new Response(JSON.stringify([bobSlot]), { status: 200 }));
      await client.getQueryCache().find({ queryKey: myTimetableQuery("bob", true).queryKey })?.promise;
      assert.deepEqual(observer.getCurrentResult().data, [bobSlot]);
      assert.notDeepEqual(observer.getCurrentResult().data, [aliceSlot]);

      observer.setOptions(myTimetableQuery(undefined, true));
      assert.equal(observer.getCurrentResult().data, undefined);
      assert.equal(observer.getCurrentResult().fetchStatus, "idle");
    } finally {
      unsubscribe();
    }
  } finally {
    globalThis.fetch = originalFetch;
    client.clear();
  }
});