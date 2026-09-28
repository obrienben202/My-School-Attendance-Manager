import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import type { AuthUser } from "@workspace/api-zod";
import { GetMyProfileResponse } from "@workspace/api-zod";
import { createSelfProfileRouter } from "../routes/staff";

const directory = [
  "Username,Password,Role,Full Name,Department,Email,Phone,Address,Postcode,Staff Code,Job Title,Organisation,Start Date,Private Notes",
  "alpha,alpha-password,staff,Alice Staff,Science,alice@school.example,111,Alpha Lane,AA1 1AA,A-01,Tutor,North School,2020-09-01,alpha-secret-note",
  "beta,beta-password,hod,Bob Head,English,bob@school.example,222,Beta Road,BB2 2BB,B-02,Head of English,South School,2021-04-05,beta-secret-note",
].join("\n");

const accounts: Record<string, AuthUser> = {
  alpha: {
    id: "alpha-id", username: "alpha", firstName: "Alice", lastName: "Staff",
    email: null, role: "staff", department: "Science", profileImageUrl: null,
  },
  beta: {
    id: "beta-id", username: "beta", firstName: "Bob", lastName: "Head",
    email: null, role: "hod", department: "English", profileImageUrl: null,
  },
};

test("GET /api/staff/me/profile isolates directory fields across signed-in accounts", async () => {
  let directoryReads = 0;
  let currentCsv = directory;
  let unavailable = false;
  let time = Date.parse("2026-09-28T12:00:00.000Z");
  const app = express();
  // Simulate the authenticated request established by the session middleware.
  // Keep the server and URL constant while changing the session cookie.
  app.use((req, _res, next) => {
    const session = req.headers.cookie?.match(/(?:^|;\s*)session=(alpha|beta)(?:;|$)/)?.[1];
    req.user = session ? accounts[session] : undefined;
    req.isAuthenticated = function (this: express.Request): this is Express.AuthedRequest {
      return !!this.user;
    };
    next();
  });
  app.use("/api", createSelfProfileRouter(async () => {
    directoryReads++;
    if (unavailable) throw new Error("Directory is offline");
    return currentCsv;
  }, () => time));

  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo | null;
    assert.ok(address);
    const url = `http://127.0.0.1:${address.port}/api/staff/me/profile`;
    const request = async (session?: string) => {
      const response = await fetch(url, {
        headers: session ? { Cookie: `session=${session}` } : {},
      });
      return {
        status: response.status,
        cacheControl: response.headers.get("cache-control"),
        body: await response.json() as Record<string, unknown>,
      };
    };

    const alphaProfile = {
      firstName: "Alice", lastName: "Staff", email: "alice@school.example",
      department: "Science", role: "staff", phone: "111", address: "Alpha Lane",
      postcode: "AA1 1AA", staffCode: "A-01", jobTitle: "Tutor",
      organisation: "North School", startDate: "2020-09-01",
      directoryStatus: "fresh", directoryVerifiedAt: "2026-09-28T12:00:00.000Z",
    };
    const betaProfile = {
      firstName: "Bob", lastName: "Head", email: "bob@school.example",
      department: "English", role: "hod", phone: "222", address: "Beta Road",
      postcode: "BB2 2BB", staffCode: "B-02", jobTitle: "Head of English",
      organisation: "South School", startDate: "2021-04-05",
      directoryStatus: "fresh", directoryVerifiedAt: "2026-09-28T12:00:00.000Z",
    };

    const first = await request("alpha");
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, alphaProfile);
    assert.equal(GetMyProfileResponse.safeParse(first.body).success, true);

    const unsigned = await request();
    assert.equal(unsigned.status, 401);
    assert.deepEqual(unsigned.body, { error: "Authentication required" });
    assert.equal(directoryReads, 1, "unsigned requests must not read the directory");

    const second = await request("beta");
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, betaProfile);
    assert.equal(GetMyProfileResponse.safeParse(second.body).success, true);

    const switchedBack = await request("alpha");
    assert.equal(switchedBack.status, 200);
    assert.deepEqual(switchedBack.body, alphaProfile);
    assert.equal(directoryReads, 2, "recent verified profile is reused only for its account");

    time += 5 * 60_000;
    unavailable = true;
    const staleAlpha = await request("alpha");
    assert.equal(staleAlpha.status, 200);
    assert.deepEqual(staleAlpha.body, { ...alphaProfile, directoryStatus: "stale" });
    assert.equal(GetMyProfileResponse.safeParse(staleAlpha.body).success, true);
    const staleBeta = await request("beta");
    assert.equal(staleBeta.status, 200);
    assert.deepEqual(staleBeta.body, { ...betaProfile, directoryStatus: "stale" });
    assert.equal(directoryReads, 4);

    // A valid sheet that no longer contains the signed-in account revokes its
    // cached directory fields; a later outage must not revive those fields.
    unavailable = false;
    currentCsv = directory.split("\n").filter(line => !line.startsWith("alpha,")).join("\n");
    const missing = await request("alpha");
    assert.equal(missing.status, 200);
    assert.equal(missing.body.directoryStatus, "missing");
    assert.equal(missing.body.directoryVerifiedAt, null);
    assert.equal(missing.body.phone, null);
    unavailable = true;
    const noCachedAlpha = await request("alpha");
    assert.equal(noCachedAlpha.status, 502);
    assert.deepEqual(noCachedAlpha.body, { error: "Profile source is unavailable" });
    assert.equal((await request("beta")).body.directoryStatus, "stale");

    // Expired verified details must not be kept indefinitely.
    time += 24 * 60 * 60_000 + 1;
    const expired = await request("beta");
    assert.equal(expired.status, 502);

    // An invalid directory is not a transport outage and cannot be served as stale.
    unavailable = false;
    currentCsv = directory;
    const restored = await request("beta");
    assert.equal(restored.status, 200);
    time += 5 * 60_000;
    currentCsv = directory + "\nBETA,duplicate,staff,Other";
    const invalid = await request("beta");
    assert.equal(invalid.status, 502);

    // Same account ID with a different username must not see the previous identity.
    accounts.beta.username = "gamma";
    unavailable = true;
    assert.equal((await request("beta")).status, 502);
    accounts.beta.username = "beta";
    unavailable = false;
    currentCsv = directory.replace("bob@school.example", "bob.new@school.example");
    const recovered = await request("beta");
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.email, "bob.new@school.example");
    assert.equal(recovered.body.directoryStatus, "fresh");
    assert.equal(recovered.body.directoryVerifiedAt, new Date(time).toISOString());

    for (const result of [first, unsigned, second, switchedBack, staleAlpha, staleBeta, missing, noCachedAlpha, expired, invalid]) {
      assert.match(result.cacheControl ?? "", /\bno-store\b/);
      const wireBody = JSON.stringify(result.body);
      for (const secret of ["alpha-password", "beta-password", "alpha-secret-note", "beta-secret-note"]) {
        assert.equal(wireBody.includes(secret), false, `${secret} must never be sent`);
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});