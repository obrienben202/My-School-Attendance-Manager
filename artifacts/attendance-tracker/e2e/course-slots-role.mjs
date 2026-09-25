import assert from "node:assert/strict";

const baseUrl = new URL(process.env.E2E_BASE_URL || "http://localhost/");
const accounts = {
  admin: [process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD],
  staff: [process.env.E2E_STAFF_USERNAME, process.env.E2E_STAFF_PASSWORD],
};

for (const [role, credentials] of Object.entries(accounts)) {
  if (credentials.some(value => !value)) {
    throw new Error(`Set E2E_${role.toUpperCase()}_USERNAME and E2E_${role.toUpperCase()}_PASSWORD in Replit Secrets.`);
  }
}

async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function signIn(role) {
  const [username, password] = accounts[role];
  const login = await request("/api/login", { method: "POST", body: { username, password } });
  assert.equal(login.status, 200, `${role} sign-in failed: ${JSON.stringify(login.body)}`);
  assert.ok(login.cookie, `${role} sign-in must set a session cookie`);
  const identity = await request("/api/auth/user", { cookie: login.cookie });
  assert.equal(identity.body?.user?.role, role, `${role} session must have the expected role`);
  return login.cookie;
}

const admin = await signIn("admin");
const staff = await signIn("staff");
const fixturePath = "/api/__e2e/course-slots-fixture";
const fixture = await request(fixturePath, { cookie: admin, method: "POST" });
const courseId = fixture.body?.id;
const slotBody = {
  day: "Friday", startTime: "08:30", endTime: "09:30",
  room: "E2E role check", weekPattern: "Every week",
};
try {
  assert.equal(fixture.status, 201, `administrator must be able to create an isolated fixture: ${JSON.stringify(fixture.body)}`);
  assert.ok(Number.isSafeInteger(courseId) && courseId > 0, "fixture must have a course id");
  const path = `/api/courses/${courseId}/slots`;
  const readSlots = async () => {
    const response = await request(path, { cookie: admin });
    assert.equal(response.status, 200);
    return response.body;
  };
  assert.equal((await request(`/api/courses/${courseId}`, { cookie: admin })).status, 404,
    "the inactive fixture must not appear as an active course");
  assert.deepEqual(await readSlots(), [], "fixture must begin without slots");

  const created = await request(path, { cookie: admin, method: "POST", body: slotBody });
  assert.equal(created.status, 201, `administrator must be able to create a slot: ${JSON.stringify(created.body)}`);
  const createdId = created.body.id;
  const unchanged = await readSlots();
  assert.equal(unchanged.length, 1);

  for (const [method, target, body] of [
    ["POST", path, slotBody],
    ["PUT", `${path}/${createdId}`, { ...slotBody, room: "unauthorised change" }],
    ["DELETE", `${path}/${createdId}`],
  ]) {
    const rejected = await request(target, { cookie: staff, method, body });
    assert.equal(rejected.status, 403, `staff ${method} must be forbidden`);
    assert.deepEqual(await readSlots(), unchanged, `staff ${method} must not change any slots`);
  }

  const updated = await request(`${path}/${createdId}`, {
    cookie: admin, method: "PUT", body: { ...slotBody, room: "E2E role check updated" },
  });
  assert.equal(updated.status, 200, "administrator must be able to update a slot");
  assert.equal(updated.body.room, "E2E role check updated");

  const removed = await request(`${path}/${createdId}`, { cookie: admin, method: "DELETE" });
  assert.equal(removed.status, 204, "administrator must be able to delete the temporary slot");
  assert.deepEqual(await readSlots(), [], "fixture slots must be empty after deletion");
} finally {
  if (Number.isSafeInteger(courseId) && courseId > 0) {
    const removed = await request(`${fixturePath}/${courseId}`, { cookie: admin, method: "DELETE" });
    assert.equal(removed.status, 204, "isolated fixture and any remaining slots must be removed");
  }
}

console.log("Signed-in staff cannot create, update, or delete course slots; administrator mutations remain available.");