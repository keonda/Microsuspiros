import test from "node:test";
import assert from "node:assert/strict";
import { applyCapturedEntry, classifyCapturedEntry, completeChecklistFromCapture, createCapturedEntry, deleteCapturedEntry, queueOfflineCapture, shouldShowSyncProblem } from "../lib/capture";
import { createDefaultState } from "../lib/shift-logic";

test("capturing creates a raw note", () => {
  const entry = createCapturedEntry("Vendor forgot oat milk");
  assert.equal(entry.rawText, "Vendor forgot oat milk");
  assert.equal(entry.confirmed, false);
  assert.ok(entry.inferredTypes.includes("report"));
});

test("rule-based classification detects inventory and location", () => {
  const classification = classifyCapturedEntry("Floor 6 almost out of coffee");
  assert.ok(classification.inferredTypes.includes("inventory"));
  assert.equal(classification.location, "Floor 6");
  assert.equal(classification.itemName, "coffee");
  assert.equal(classification.urgency, "urgent");
});

test("captured inventory entry creates inbox item and need now item", () => {
  const state = createDefaultState();
  const entry = createCapturedEntry("Need 3 coffee bags tomorrow");
  const next = applyCapturedEntry(state, entry);
  assert.equal(next.capturedEntries[0].id, entry.id);
  assert.equal(next.needNow[0].quantity, 3);
  assert.equal(next.needNow[0].name, "coffee bag");
});

test("completed coffee phrase completes checklist item", () => {
  const state = createDefaultState();
  const entry = createCapturedEntry("finished coffee on floor 6");
  const next = completeChecklistFromCapture(state, entry);
  assert.equal(next.checklist.find((item) => item.id === "brew-coffee")?.done, true);
});

test("offline capture queue keeps entries in order", () => {
  const first = createCapturedEntry("Coffee low");
  const second = createCapturedEntry("Cups missing");
  const queue = queueOfflineCapture(queueOfflineCapture([], first), second);
  assert.deepEqual(queue.map((entry) => entry.rawText), ["Cups missing", "Coffee low"]);
});

test("sync problem UI only shows for offline or failed sync", () => {
  assert.equal(shouldShowSyncProblem("Synced", true), false);
  assert.equal(shouldShowSyncProblem("Sync pending", true), false);
  assert.equal(shouldShowSyncProblem("Sync failed", true), true);
  assert.equal(shouldShowSyncProblem("Synced", false), true);
});

test("deleting a captured entry creates a sync tombstone", () => {
  const state = applyCapturedEntry(createDefaultState(), createCapturedEntry("Photo note captured"));
  const next = deleteCapturedEntry(state, state.capturedEntries[0].id);
  assert.equal(next.capturedEntries[0].deleted, true);
  assert.equal(next.capturedEntries[0].dismissed, true);
});
