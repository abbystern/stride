export type RecoveryEntry = {
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number;
  energy_rating: number;
  soreness_rating: number;
  created_at: string;
};
export type RecoveryValues = {
  sleep_hours: string;
  energy_rating: string;
  soreness_rating: string;
};
export type RecoveryMetrics = Pick<RecoveryEntry, "sleep_hours" | "energy_rating" | "soreness_rating">;
export type RecoveryErrors = Partial<Record<keyof RecoveryValues, string>>;

export function emptyRecoveryValues(): RecoveryValues {
  return { sleep_hours: "", energy_rating: "", soreness_rating: "" };
}

export function recoveryToValues(entry: RecoveryEntry): RecoveryValues {
  return { sleep_hours: String(entry.sleep_hours), energy_rating: String(entry.energy_rating), soreness_rating: String(entry.soreness_rating) };
}

export function validateRecovery(values: RecoveryValues): { errors: RecoveryErrors; payload: RecoveryMetrics | null } {
  const errors: RecoveryErrors = {};
  const sleep = values.sleep_hours.trim() === "" ? NaN : Number(values.sleep_hours);
  const energy = values.energy_rating.trim() === "" ? NaN : Number(values.energy_rating);
  const soreness = values.soreness_rating.trim() === "" ? NaN : Number(values.soreness_rating);
  if (!values.sleep_hours.trim()) errors.sleep_hours = "Enter your sleep hours.";
  else if (!Number.isFinite(sleep) || sleep < 0 || sleep > 24) errors.sleep_hours = "Sleep must be between 0 and 24 hours.";
  if (!values.energy_rating.trim()) errors.energy_rating = "Choose an energy rating.";
  else if (!Number.isInteger(energy) || energy < 1 || energy > 5) errors.energy_rating = "Energy must be a whole number from 1 to 5.";
  if (!values.soreness_rating.trim()) errors.soreness_rating = "Choose a soreness rating.";
  else if (!Number.isInteger(soreness) || soreness < 1 || soreness > 5) errors.soreness_rating = "Soreness must be a whole number from 1 to 5.";
  return {
    errors,
    payload: Object.keys(errors).length ? null : { sleep_hours: sleep, energy_rating: energy, soreness_rating: soreness },
  };
}
