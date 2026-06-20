/**
 * UK DC Pension "Stop Contributing" Calculator
 *
 * All monetary values in £. Growth rate as a decimal (e.g. 0.05 for 5%).
 *
 * UK 2024/25 higher-rate income tax threshold (personal allowance + basic rate band).
 * Pension drawdown above this amount is taxed at 40%.
 */
export const HIGHER_RATE_THRESHOLD = 50_270;

/**
 * Perpetuity target pot: the minimum pot that sustains `annualDrawdown` indefinitely
 * at `growthRate` (annual returns equal or exceed the drawdown).
 * When growthRate is 0, falls back to a 50-year horizon.
 */
export function perpetuityTarget(annualDrawdown, growthRate) {
  if (growthRate <= 0) return annualDrawdown * 50;
  return annualDrawdown / growthRate;
}

/**
 * How many years until a pot of `pot` is fully depleted, drawing `annualDrawdown`
 * per year while growing at `growthRate` per year.
 *
 * Returns Infinity when annual returns on the pot meet or exceed the drawdown
 * (i.e. the pot never depletes).
 *
 * Formula (r > 0):  N = -ln(1 - pot·r / drawdown) / ln(1 + r)
 */
export function depletionYears(pot, annualDrawdown, growthRate) {
  if (annualDrawdown <= 0) return Infinity;
  if (growthRate <= 0) return pot / annualDrawdown; // linear depletion
  const ratio = (pot * growthRate) / annualDrawdown;
  if (ratio >= 1) return Infinity; // returns cover or exceed drawdown
  return -Math.log(1 - ratio) / Math.log(1 + growthRate);
}

/**
 * Calculate the results for the pension stop-contributing calculator.
 *
 * @param {object} inputs
 * @param {number} inputs.currentAge
 * @param {number} inputs.currentPot  - current pot size in £
 * @param {number} inputs.retirementAge
 * @param {number} inputs.annualDrawdown  - desired annual drawdown in £
 * @param {number} inputs.growthRatePct  - annual growth rate as percentage (e.g. 5 for 5%)
 *
 * @returns {object} calculation results
 */
export function calculatePensionStop({
  currentAge,
  currentPot,
  retirementAge,
  annualDrawdown,
  growthRatePct,
}) {
  const r = growthRatePct / 100;
  const yearsToRetirement = retirementAge - currentAge;

  // --- Criterion 1: Sufficiency (perpetuity) ---
  // Min pot AT retirement such that annual growth >= drawdown (money never runs out).
  // At r=0 falls back to a 50-year horizon.
  const sufficiencyPotAtRetirement = perpetuityTarget(annualDrawdown, r);

  // --- Criterion 2: 40% Tax Band ---
  const taxBreachesThreshold = annualDrawdown > HIGHER_RATE_THRESHOLD;
  const taxPotAtRetirement = perpetuityTarget(HIGHER_RATE_THRESHOLD, r);

  // --- Effective target ---
  // Take the lower of the two
  const effectivePotAtRetirement = taxBreachesThreshold
    ? Math.min(sufficiencyPotAtRetirement, taxPotAtRetirement)
    : sufficiencyPotAtRetirement;

  const triggeringCriterion = taxBreachesThreshold
    ? (taxPotAtRetirement <= sufficiencyPotAtRetirement ? 'tax' : 'sufficiency')
    : 'sufficiency';

  // Effective annual drawdown in retirement (capped at threshold when tax criterion applies)
  const effectiveDrawdown =
    triggeringCriterion === 'tax' ? HIGHER_RATE_THRESHOLD : annualDrawdown;

  // --- Depletion age at the effective target pot ---
  const yearsUntilDepletionAtTarget = depletionYears(effectivePotAtRetirement, effectiveDrawdown, r);
  const depletionAgeAtTarget =
    yearsUntilDepletionAtTarget === Infinity
      ? Infinity
      : retirementAge + yearsUntilDepletionAtTarget;

  // --- Current projected pot and its depletion age ---
  const projectedPotAtRetirement = currentPot * Math.pow(1 + r, yearsToRetirement);
  const yearsUntilDepletionCurrentPot = depletionYears(projectedPotAtRetirement, annualDrawdown, r);
  const depletionAgeCurrentPot =
    yearsUntilDepletionCurrentPot === Infinity
      ? Infinity
      : retirementAge + yearsUntilDepletionCurrentPot;

  // --- Discount effective target back to today ---
  const stopPotToday =
    yearsToRetirement > 0
      ? effectivePotAtRetirement / Math.pow(1 + r, yearsToRetirement)
      : effectivePotAtRetirement;

  const alreadyAtTarget = currentPot >= stopPotToday;

  return {
    yearsToRetirement,
    r,

    // Criterion 1
    sufficiencyPotAtRetirement,

    // Criterion 2
    taxBreachesThreshold,
    taxPotAtRetirement,

    // Effective target
    effectivePotAtRetirement,
    effectiveDrawdown,
    triggeringCriterion,

    // Depletion ages
    depletionAgeAtTarget,
    depletionAgeCurrentPot,

    // Stop pot in today's money
    stopPotToday,

    // Current trajectory
    projectedPotAtRetirement,

    // Final recommendation
    alreadyAtTarget,
  };
}
