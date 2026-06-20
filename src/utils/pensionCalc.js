/**
 * UK DC Pension "Stop Contributing" Calculator
 *
 * All monetary values in £. Growth rate as a decimal (e.g. 0.05 for 5%).
 *
 * UK 2024/25 higher-rate income tax threshold (personal allowance + basic rate band).
 * Pension drawdown above this amount is taxed at 40%.
 */
export const HIGHER_RATE_THRESHOLD = 50_270;
export const TAX_FREE_LUMP_SUM = 268_275;

/**
 * Present value of an annuity paying `annualAmount` for `years` at `growthRate`.
 * This is the pot needed at retirement to fund the drawdown for exactly `years`.
 * Handles growthRate === 0 as linear (pot = annualAmount * years).
 */
export function presentValueOfAnnuity(annualAmount, growthRate, years) {
  if (years <= 0) return 0;
  if (growthRate === 0) return annualAmount * years;
  return annualAmount * (1 - Math.pow(1 + growthRate, -years)) / growthRate;
}

/**
 * How many years until a pot of `pot` is fully depleted, drawing `annualDrawdown`
 * per year while growing at `growthRate` per year.
 *
 * Returns Infinity when annual returns on the pot meet or exceed the drawdown.
 * Formula (r > 0):  N = -ln(1 - pot·r / drawdown) / ln(1 + r)
 */
export function depletionYears(pot, annualDrawdown, growthRate) {
  if (annualDrawdown <= 0) return Infinity;
  if (growthRate <= 0) return pot / annualDrawdown;
  const ratio = (pot * growthRate) / annualDrawdown;
  if (ratio >= 1) return Infinity;
  return -Math.log(1 - ratio) / Math.log(1 + growthRate);
}

/**
 * Calculate the results for the pension stop-contributing calculator.
 *
 * @param {object} inputs
 * @param {number} inputs.currentAge
 * @param {number} inputs.currentPot       - current pot size in £
 * @param {number} inputs.retirementAge
 * @param {number} inputs.targetAge        - age at which the pot should run out
 * @param {number} inputs.annualDrawdown   - desired annual drawdown in £
 * @param {number} inputs.growthRatePct    - annual growth rate as percentage (e.g. 5 for 5%)
 * @param {number} inputs.lumpSumPct       - 0–25: % of pot to take tax-free at retirement
 *
 * @returns {object} calculation results
 */
export function calculatePensionStop({
  currentAge,
  currentPot,
  retirementAge,
  targetAge,
  annualDrawdown,
  growthRatePct,
  lumpSumPct = 0,
}) {
  const r = growthRatePct / 100;
  const p = lumpSumPct / 100;
  const yearsToRetirement = retirementAge - currentAge;
  const yearsInRetirement = targetAge - retirementAge;

  /**
   * Compute total pot and lump sum for a given drawdown base (PV of annuity).
   * The lump sum is taken from the pot first; the remainder funds the drawdown.
   *
   * Let L = lump sum, D = drawdown base (pot needed after lump sum).
   * Total pot T = D + L,  L = p * T  →  T = D / (1 - p),  L = p*D / (1-p)
   * Capped at TAX_FREE_LUMP_SUM.
   */
  function potWithLumpSum(drawdownBase) {
    if (p === 0) return { total: drawdownBase, lumpSum: 0 };
    const uncappedLumpSum = (p * drawdownBase) / (1 - p);
    const lumpSum = Math.min(uncappedLumpSum, TAX_FREE_LUMP_SUM);
    return { total: drawdownBase + lumpSum, lumpSum };
  }

  // --- Criterion 1: Sufficiency ---
  // Pot needed at retirement so the drawdown pot (after lump sum) funds annualDrawdown
  // for exactly yearsInRetirement years.
  const sufficiencyBase = presentValueOfAnnuity(annualDrawdown, r, yearsInRetirement);
  const suf = potWithLumpSum(sufficiencyBase);
  const sufficiencyPotAtRetirement = suf.total;

  // --- Criterion 2: 40% Tax Band ---
  const taxBreachesThreshold = annualDrawdown > HIGHER_RATE_THRESHOLD;
  const taxBase = presentValueOfAnnuity(HIGHER_RATE_THRESHOLD, r, yearsInRetirement);
  const tax = potWithLumpSum(taxBase);
  const taxPotAtRetirement = tax.total;

  // --- Effective target ---
  const effectivePotAtRetirement = taxBreachesThreshold
    ? Math.min(sufficiencyPotAtRetirement, taxPotAtRetirement)
    : sufficiencyPotAtRetirement;

  const triggeringCriterion = taxBreachesThreshold
    ? (taxPotAtRetirement <= sufficiencyPotAtRetirement ? 'tax' : 'sufficiency')
    : 'sufficiency';

  const lumpSumAmount = triggeringCriterion === 'tax' ? tax.lumpSum : suf.lumpSum;
  const lumpSumCapped = lumpSumAmount >= TAX_FREE_LUMP_SUM && p > 0;

  const effectiveDrawdown =
    triggeringCriterion === 'tax' ? HIGHER_RATE_THRESHOLD : annualDrawdown;

  // Pot available for drawdown after lump sum
  const drawdownPotAtRetirement = effectivePotAtRetirement - lumpSumAmount;

  // Actual depletion age of the drawdown pot (should be ≈ targetAge; useful as sanity check)
  const actualYearsUntilDepletion = depletionYears(drawdownPotAtRetirement, effectiveDrawdown, r);
  const actualDepletionAge =
    actualYearsUntilDepletion === Infinity
      ? Infinity
      : retirementAge + actualYearsUntilDepletion;

  // --- Current projected pot and its depletion age ---
  const projectedPotAtRetirement = currentPot * Math.pow(1 + r, yearsToRetirement);
  const projectedLumpSum = p > 0 ? Math.min(p * projectedPotAtRetirement, TAX_FREE_LUMP_SUM) : 0;
  const projectedDrawdownPot = projectedPotAtRetirement - projectedLumpSum;
  const yearsUntilDepletionCurrentPot = projectedDrawdownPot > 0
    ? depletionYears(projectedDrawdownPot, annualDrawdown, r)
    : 0;
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
    yearsInRetirement,
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

    // Lump sum
    lumpSumPct,
    lumpSumAmount,
    lumpSumCapped,
    drawdownPotAtRetirement,

    // Depletion ages
    targetAge,
    actualDepletionAge,
    depletionAgeCurrentPot,

    // Stop pot in today's money
    stopPotToday,

    // Current trajectory
    projectedPotAtRetirement,

    // Final recommendation
    alreadyAtTarget,
  };
}
