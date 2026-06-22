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

// UK 2024/25 full new State Pension. Assumed to grow with inflation → constant in real terms.
export const STATE_PENSION_AGE = 68;
export const STATE_PENSION_ANNUAL = 221.20 * 52; // £11,502.40/yr

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
 * @param {boolean} inputs.includeStatePension - whether to factor in state pension
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
  inflationPct = 0,
  lumpSumPct = 0,
  includeStatePension = true,
}) {
  const r_nominal = growthRatePct / 100;
  const inflation = inflationPct / 100;
  // All calculations in real terms (today's money)
  const r = (1 + r_nominal) / (1 + inflation) - 1;
  const p = lumpSumPct / 100;
  const yearsToRetirement = retirementAge - currentAge;
  const yearsInRetirement = targetAge - retirementAge;

  // --- State pension phases ---
  // Phase 1: retirement → state pension age (no state pension income)
  // Phase 2: state pension age → target age (state pension offsets drawdown from pot)
  const statePension = includeStatePension ? STATE_PENSION_ANNUAL : 0;
  const phase1Years = includeStatePension
    ? Math.max(0, Math.min(STATE_PENSION_AGE - retirementAge, yearsInRetirement))
    : yearsInRetirement;
  const phase2Years = includeStatePension
    ? Math.max(0, targetAge - Math.max(retirementAge, STATE_PENSION_AGE))
    : 0;

  /**
   * Two-phase present value of annuity at retirement.
   * phase1: pot funds `amount1` for phase1Years
   * phase2: pot funds `amount2` for phase2Years (discounted back through phase1)
   */
  function twoPhasePVA(amount1, amount2) {
    const pv1 = presentValueOfAnnuity(amount1, r, phase1Years);
    const pv2Phase2 = presentValueOfAnnuity(Math.max(0, amount2), r, phase2Years);
    // Discount phase2 PV back to retirement date
    const pv2AtRetirement = phase1Years > 0
      ? pv2Phase2 / Math.pow(1 + r, phase1Years)
      : pv2Phase2;
    return pv1 + pv2AtRetirement;
  }

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
  // Phase 1: pot funds full drawdown. Phase 2: pot funds drawdown minus state pension.
  const sufficiencyBase = twoPhasePVA(annualDrawdown, annualDrawdown - statePension);
  const suf = potWithLumpSum(sufficiencyBase);
  const sufficiencyPotAtRetirement = suf.total;

  // --- Criterion 2: 40% Tax Band ---
  // Phase 2 total income = drawdown + statePension; breach when that exceeds threshold.
  // Effective drawdown threshold: phase1 = full threshold, phase2 = threshold - statePension.
  const effectiveTaxThresholdPhase2 = HIGHER_RATE_THRESHOLD - statePension;
  const taxBreachesThreshold = includeStatePension
    ? annualDrawdown + statePension > HIGHER_RATE_THRESHOLD   // phase 2 is binding
    : annualDrawdown > HIGHER_RATE_THRESHOLD;
  const taxBase = twoPhasePVA(HIGHER_RATE_THRESHOLD, effectiveTaxThresholdPhase2);
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

  // Simulate year-by-year depletion of the current pot in retirement (accounts for two phases).
  let simPot = projectedDrawdownPot;
  let depletionAgeCurrentPot = Infinity;
  for (let age = retirementAge; age <= 200; age++) {
    if (simPot <= 0) { depletionAgeCurrentPot = age; break; }
    const drawThisYear = includeStatePension && age >= STATE_PENSION_AGE
      ? Math.max(0, annualDrawdown - statePension)
      : annualDrawdown;
    simPot = simPot * (1 + r) - drawThisYear;
  }

  // --- Discount effective target back to today ---
  const stopPotToday =
    yearsToRetirement > 0
      ? effectivePotAtRetirement / Math.pow(1 + r, yearsToRetirement)
      : effectivePotAtRetirement;

  const alreadyAtTarget = currentPot >= stopPotToday;

  // --- Nominal values at retirement (future £) ---
  // These are for display clarity only; calculations stay in real terms.
  const inflationFactor = Math.pow(1 + inflation, yearsToRetirement);
  const nominalDrawdownAtRetirement = annualDrawdown * inflationFactor;
  const nominalThresholdAtRetirement = HIGHER_RATE_THRESHOLD * inflationFactor;
  const nominalEffectiveDrawdown = effectiveDrawdown * inflationFactor;
  const nominalLumpSumAmount = lumpSumAmount * inflationFactor;

  // --- Perpetuity pot (infinite drawdown) ---
  // The pot at which annual real growth equals the drawdown — money never runs out.
  // Formula: P = D / r  (only meaningful when r > 0)
  const infinitePotAtRetirement = r > 0 ? annualDrawdown / r : Infinity;
  const infinitePotToday =
    infinitePotAtRetirement === Infinity || yearsToRetirement <= 0
      ? infinitePotAtRetirement
      : infinitePotAtRetirement / Math.pow(1 + r, yearsToRetirement);

  return {
    yearsToRetirement,
    yearsInRetirement,
    r,          // real growth rate
    r_nominal,
    inflation,

    // State pension
    includeStatePension,
    statePension,
    phase1Years,
    phase2Years,
    effectiveTaxThresholdPhase2,

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

    // Nominal (future £) at retirement
    nominalDrawdownAtRetirement,
    nominalThresholdAtRetirement,
    nominalEffectiveDrawdown,
    nominalLumpSumAmount,

    // Perpetuity (infinite drawdown) pot
    infinitePotAtRetirement,
    infinitePotToday,

    // Final recommendation
    alreadyAtTarget,
  };
}
