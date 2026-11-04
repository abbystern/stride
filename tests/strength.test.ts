import assert from "node:assert/strict";
import test from "node:test";
import { emptyExercise, setToDraft, validateSetDrafts, validateTemplate, type StrengthSet } from "../src/lib/strengthModel.ts";

test("strength templates validate names, set count, rep bounds and exercise notes", () => {
  const exercise = { ...emptyExercise(), name: "Chest Press" };
  assert.equal(validateTemplate("Upper A", [exercise]), "");
  assert.match(validateTemplate("", [exercise]), /name/);
  assert.match(validateTemplate("Upper A", []), /exercises/);
  for (const target_sets of ["0", "-1", "1.5", "21", "NaN", ""]) {
    assert.match(validateTemplate("Upper A", [{ ...exercise, target_sets }]), /sets/);
  }
  assert.match(validateTemplate("Upper A", [{ ...exercise, rep_min: "11" }]), /maximum/);
  assert.match(validateTemplate("Upper A", [{ ...exercise, rep_max: "1.5" }]), /whole-number/);
  assert.match(validateTemplate("Upper A", [{ ...exercise, notes: "a".repeat(2001) }]), /notes/);
  assert.match(validateTemplate("Upper A", [exercise, { ...exercise, name: " chest press " }]), /once/);
  assert.equal(validateTemplate("Upper A", [{ ...exercise, target_sets: "20", rep_max: "1000" }]), "");
});
test("incomplete sets allow blank entries, zero weight and partial saves", () => {
  assert.equal(validateSetDrafts([{ id: "1", weight_lbs: "", reps: "", completed: false }]), "");
  assert.equal(validateSetDrafts([{ id: "1", weight_lbs: "0", reps: "10", completed: true }]), "");
  assert.equal(validateSetDrafts([{ id: "1", weight_lbs: "67.5", reps: "9", completed: true }]), "");
});
test("completed sets require valid nonnegative finite weight and positive whole reps", () => {
  const set = { id: "1", weight_lbs: "65", reps: "10", completed: true };
  for (const weight_lbs of ["", "-1", "NaN", "Infinity", "1e999"]) assert.ok(validateSetDrafts([{ ...set, weight_lbs }]));
  for (const reps of ["", "0", "-1", "9.5", "NaN", "1001"]) assert.ok(validateSetDrafts([{ ...set, reps }]));
  assert.match(validateSetDrafts([set, set]), /Duplicate/);
});
test("finishing needs a completed set but permits other unfinished entries", () => {
  const entries = [{ id: "1", weight_lbs: "", reps: "", completed: false }];
  assert.equal(validateSetDrafts(entries), "");
  assert.match(validateSetDrafts(entries, true), /at least one/);
  assert.equal(validateSetDrafts([...entries, { id: "2", weight_lbs: "65", reps: "10", completed: true }], true), "");
});
test("loading persisted drafts retains zero weights, nulls and set completion", () => {
  const source = { id: "1", weight_lbs: 0, reps: 10, completed: true } as StrengthSet;
  assert.deepEqual(setToDraft(source), { id: "1", weight_lbs: "0", reps: "10", completed: true });
  assert.deepEqual(setToDraft({ ...source, weight_lbs: null, reps: null, completed: false }), { id: "1", weight_lbs: "", reps: "", completed: false });
});
