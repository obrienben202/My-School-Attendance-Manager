import assert from "node:assert/strict";
import test from "node:test";
import {
  hasOnlyEmptyRosters,
  resolveRegisterListState,
} from "./register-list-state.ts";

test("register list states distinguish loading, failure, assignment, filter, and populated results", () => {
  assert.equal(resolveRegisterListState({
    isLoading: true,
    isError: false,
    registerCount: 0,
    filteredCount: 0,
  }), "loading");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: true,
    registerCount: 0,
    filteredCount: 0,
  }), "error");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: false,
    registerCount: 0,
    filteredCount: 0,
  }), "no-assigned-lessons");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: false,
    registerCount: 2,
    filteredCount: 0,
  }), "filter-empty");
  assert.equal(resolveRegisterListState({
    isLoading: false,
    isError: false,
    registerCount: 2,
    filteredCount: 1,
  }), "ready");
});

test("empty roster guidance is shown only when every assigned register has no learners", () => {
  assert.equal(hasOnlyEmptyRosters([]), false);
  assert.equal(hasOnlyEmptyRosters([{ enrolled: 0 }, { enrolled: 0 }]), true);
  assert.equal(hasOnlyEmptyRosters([{ enrolled: 0 }, { enrolled: 1 }]), false);
});