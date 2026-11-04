import assert from "node:assert/strict";
import test from "node:test";
import { emptyRecoveryValues, recoveryToValues, validateRecovery, type RecoveryEntry } from "../src/lib/recoveryModel.ts";

const valid = { sleep_hours: "7.5", energy_rating: "4", soreness_rating: "2" };
test("recovery accepts decimal sleep, boundaries and valid integer ratings", () => {
  assert.deepEqual(validateRecovery(valid), { errors: {}, payload: { sleep_hours: 7.5, energy_rating: 4, soreness_rating: 2 } });
  assert.ok(validateRecovery({ sleep_hours: "0", energy_rating: "1", soreness_rating: "5" }).payload);
  assert.ok(validateRecovery({ sleep_hours: "24", energy_rating: "5", soreness_rating: "1" }).payload);
  assert.ok(validateRecovery({ ...valid, sleep_hours: "7.25" }).payload);
});
test("all three recovery values are required, never defaulted to zero", () => {
  const result = validateRecovery(emptyRecoveryValues());
  assert.equal(result.payload, null);
  assert.deepEqual(Object.keys(result.errors), ["sleep_hours", "energy_rating", "soreness_rating"]);
  assert.equal(validateRecovery({ ...valid, sleep_hours: " " }).payload, null);
});
test("sleep rejects nonfinite, nonnumeric and out-of-range values", () => {
  for (const sleep_hours of ["-1", "24.1", "NaN", "Infinity", "1e999", "seven"]) {
    assert.ok(validateRecovery({ ...valid, sleep_hours }).errors.sleep_hours, sleep_hours);
  }
});
test("ratings reject fractions and values outside 1–5 independently", () => {
  for (const field of ["energy_rating", "soreness_rating"] as const) {
    for (const value of ["", "0", "-1", "6", "2.5", "Infinity", "NaN", "high"]) {
      const result = validateRecovery({ ...valid, [field]: value });
      assert.ok(result.errors[field], `${field}=${value}`);
      assert.equal(result.payload, null);
    }
  }
});
test("loading an existing check-in preserves zero sleep and decimal values", () => {
  assert.deepEqual(recoveryToValues({ sleep_hours: 0, energy_rating: 1, soreness_rating: 5 } as RecoveryEntry),
    { sleep_hours: "0", energy_rating: "1", soreness_rating: "5" });
  assert.equal(recoveryToValues({ sleep_hours: 7.5, energy_rating: 4, soreness_rating: 2 } as RecoveryEntry).sleep_hours, "7.5");
});
