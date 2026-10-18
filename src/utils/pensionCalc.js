/**
 * UK DC Pension "Stop Contributing" Calculator
 *
 * All calculations run in real terms (today's money) using the real growth rate
 * r = (1 + nominal growth) / (1 + inflation) − 1. Retirement is modelled year by year,
 * with withdrawals taken at the end of each year.
 *
 * "Income" means gross (before-tax) retirement income: pension withdrawals plus the
 * State Pension, when included. The State Pension reduces what the pot has to fund.
 *
 * Rules and rates are for the 2026/27 tax year (England, Wales and Northern Ireland).
 */

export const TAX_YEAR = '2026/27';

// Higher-rate threshold (Personal Allowance + basic-rate band). Frozen in cash terms until
// 5 April 2031, so it falls in real terms until then; assumed to rise with inflation afterwards.
export const HIGHER_RATE_THRESHOLD = 50_270;
export const THRESHOLD_FREEZE_END = new Date(2031, 3, 6);

// Lump Sum Allowance: lifetime cap on tax-free cash. Fixed in cash terms (not index-linked).
export const TAX_FREE_LUMP_SUM = 268_275;
export const MAX_TAX_FREE_PCT = 25;

// Normal minimum pension age: 55, rising to 57 from 6 April 2028.
export const NMPA_RISE_DATE = new Date(2028, 3, 6);

// Full new State Pension (2026/27). Assumed to rise with inflation → constant in real terms.
export const STATE_PENSION_WEEKLY = 241.3;
export const STATE_PENSION_ANNUAL = STATE_PENSION_WEEKLY * 52; // £12,547.60/yr

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const yearsBetween = (from, to) => (to - from) / MS_PER_YEAR;

/**
 * State Pension age under current legislation, using the latest birth date consistent with
 * `currentAge` (the conservative choice). Transitional cohorts are rounded up to a whole year:
 *   born before 6 Apr 1960 → 66 · 6 Apr 1960 – 5 Apr 1977 → 67 · on/after 6 Apr 1977 → 68
 */
export function statePensionAge(currentAge, now = new Date()) {
  const latestBirthDate = new Date(now.getFullYear() - currentAge, now.getMonth(), now.getDate());
  if (latestBirthDate < new Date(1960, 3, 6)) return 66;
  if (latestBirthDate < new Date(1977, 3, 6)) return 67;
  return 68;
}

/** Normal minimum pension age at the planned retirement date: 55, or 57 from 6 April 2028. */
export function minimumPensionAge(currentAge, retirementAge, now = new Date()) {
  const retirementDate = new Date(now.getTime() + (retirementAge - currentAge) * MS_PER_YEAR);
  return retirementDate < NMPA_RISE_DATE ? 55 : 57;
}

/**
 * Present value of an annuity paying `annualAmount` at the end of each year for `years`.
 * Handles growthRate === 0 as linear (annualAmount * years).
 */
export function presentValueOfAnnuity(annualAmount, growthRate, years) {
  if (years <= 0) return 0;
  if (growthRate === 0) return annualAmount * years;
  return annualAmount * (1 - Math.pow(1 + growthRate, -years)) / growthRate;
}

/** Present value of `payments[k]` paid at the end of year k + 1. */
function presentValue(payments, r) {
  return payments.reduce((pv, amount, k) => pv + amount / Math.pow(1 + r, k + 1), 0);
}

/**
 * Age (fractional) at which a pot starting at `startAge` can no longer fund
 * `withdrawalAt(age)`, or Infinity if it lasts beyond `maxAge`.
 */
function depletionAge(pot, startAge, r, withdrawalAt, maxAge = 200) {
  for (let age = startAge; age < maxAge; age++) {
    const available = pot * (1 + r);
    const withdrawal = withdrawalAt(age);
    if (withdrawal > 0 && available < withdrawal * (1 - 1e-9)) {
      return age + Math.max(0, available) / withdrawal;
    }
    pot = available - withdrawal;
  }
  return Infinity;
}

/** Year-by-year pot size (real terms), taking the lump sum and withdrawals from retirement. */
function potSeries({ startAge, endAge, startPot, retirementAge, lumpSum, r, withdrawalAt }) {
  const series = [];
  let pot = startPot;
  for (let age = startAge; age <= endAge; age++) {
    series.push({ age, pot: Math.max(0, pot) });
    if (age === retirementAge) pot -= lumpSum;
    pot = Math.max(0, pot * (1 + r) - (age >= retirementAge ? withdrawalAt(age) : 0));
  }
  return series;
}

/**
 * Calculate the results for the pension stop-contributing calculator.
 *
 * @param {object} inputs
 * @param {number} inputs.currentAge
 * @param {number} inputs.currentPot       - current pot size in £
 * @param {number} inputs.retirementAge
 * @param {number} inputs.targetAge        - age at which the pot should run out
 * @param {number} inputs.annualDrawdown   - desired annual income before tax, in today's £,
 *                                           including the State Pension when included
 * @param {number} inputs.growthRatePct    - nominal annual growth after fees (e.g. 5 for 5%)
 * @param {number} inputs.inflationPct     - annual inflation (e.g. 2.5 for 2.5%)
 * @param {number} inputs.lumpSumPct       - 0–25: % of pot taken as tax-free cash at retirement
 * @param {boolean} inputs.includeStatePension - whether to factor in the State Pension
 * @param {Date}   [inputs.now]            - today's date (for date-dependent rules)
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
  now = new Date(),
}) {
  const r_nominal = growthRatePct / 100;
  const inflation = inflationPct / 100;
  // All calculations in real terms (today's money)
  const r = (1 + r_nominal) / (1 + inflation) - 1;
  const p = lumpSumPct / 100;
  const yearsToRetirement = retirementAge - currentAge;
  const yearsInRetirement = targetAge - retirementAge;
  const inflationFactor = Math.pow(1 + inflation, yearsToRetirement);
  const discountToToday = (amountAtRetirement) =>
    amountAtRetirement / Math.pow(1 + r, yearsToRetirement);

  // --- Rules over time, in today's money ---
  const spAge = statePensionAge(currentAge, now);
  const statePension = includeStatePension ? STATE_PENSION_ANNUAL : 0;
  const statePensionAt = (age) => (includeStatePension && age >= spAge ? STATE_PENSION_ANNUAL : 0);

  const frozenYears = Math.max(0, yearsBetween(now, THRESHOLD_FREEZE_END));
  const thresholdAt = (age) =>
    HIGHER_RATE_THRESHOLD / Math.pow(1 + inflation, Math.min(age - currentAge, frozenYears));

  // The Lump Sum Allowance is fixed in cash terms, so it is worth less in today's money by retirement.
  const lumpSumCap = TAX_FREE_LUMP_SUM / inflationFactor;

  /**
   * Split a pot at retirement into upfront tax-free cash and the drawdown pot. Any tax-free
   * entitlement not taken upfront is spread across withdrawals as a tax-free share of each one.
   */
  function splitPot(total) {
    const entitlement = Math.min((MAX_TAX_FREE_PCT / 100) * total, lumpSumCap);
    const lumpSum = Math.min(p * total, lumpSumCap);
    const drawdownPot = total - lumpSum;
    const taxFreeShare = drawdownPot > 0 ? Math.max(0, entitlement - lumpSum) / drawdownPot : 0;
    return { total, lumpSum, drawdownPot, taxFreeShare };
  }

  /** Total pot at retirement whose drawdown pot (after any lump sum) equals `drawdownPot`. */
  function totalForDrawdownPot(drawdownPot) {
    if (!Number.isFinite(drawdownPot)) return Infinity;
    const uncapped = drawdownPot / (1 - p);
    return p * uncapped <= lumpSumCap ? uncapped : drawdownPot + lumpSumCap;
  }

  /**
   * Smallest pot at retirement whose drawdown pot funds `withdrawalsFor(taxFreeShare)`
   * (one amount per retirement year) until the target age. Solved by bisection because the
   * tax-free share depends on the pot size once the Lump Sum Allowance applies.
   */
  function solvePot(withdrawalsFor) {
    const shortfall = (total) => {
      const { drawdownPot, taxFreeShare } = splitPot(total);
      return presentValue(withdrawalsFor(taxFreeShare), r) - drawdownPot;
    };
    let lo = 0;
    let hi = 1;
    while (shortfall(hi) > 0 && hi < 1e15) hi *= 2;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (shortfall(mid) > 0) lo = mid;
      else hi = mid;
    }
    const split = splitPot(hi);
    return { ...split, withdrawals: withdrawalsFor(split.taxFreeShare) };
  }

  const retirementAges = Array.from({ length: yearsInRetirement }, (_, k) => retirementAge + k);
  const desiredWithdrawalAt = (age) => Math.max(0, annualDrawdown - statePensionAt(age));
  // Largest withdrawal keeping taxable income (taxable share of withdrawal + State Pension)
  // within the basic-rate band.
  const maxBasicRateWithdrawalAt = (age, taxFreeShare) =>
    Math.max(0, thresholdAt(age) - statePensionAt(age)) / (1 - taxFreeShare);

  // --- Criterion 1: Sufficiency — fund the desired income every year until the target age ---
  const sufficiency = solvePot(() => retirementAges.map(desiredWithdrawalAt));

  // --- Criterion 2: 40% tax band — never withdraw more than keeps you in the basic-rate band ---
  const plan = solvePot((taxFreeShare) =>
    retirementAges.map((age) =>
      Math.min(desiredWithdrawalAt(age), maxBasicRateWithdrawalAt(age, taxFreeShare)),
    ),
  );
  const taxBreachesThreshold = plan.total < sufficiency.total - 0.01;
  const triggeringCriterion = taxBreachesThreshold ? 'tax' : 'sufficiency';

  const incomePlan = retirementAges.map((age, k) => {
    const withdrawal = plan.withdrawals[k];
    const sp = statePensionAt(age);
    return {
      age,
      withdrawal,
      statePension: sp,
      income: withdrawal + sp,
      taxableIncome: withdrawal * (1 - plan.taxFreeShare) + sp,
      threshold: thresholdAt(age),
      capped: withdrawal < desiredWithdrawalAt(age) - 0.01,
    };
  });
  const firstTaxCappedAge = incomePlan.find((year) => year.capped)?.age ?? null;
  const effectiveIncomeFirstYear = incomePlan[0]?.income ?? 0;

  const planWithdrawalAt = (age) => plan.withdrawals[age - retirementAge] ?? desiredWithdrawalAt(age);

  // Sanity check: the planned drawdown pot should run out at the target age.
  const actualDepletionAge = depletionAge(plan.drawdownPot, retirementAge, r, planWithdrawalAt);

  // --- Effective target, and the moving target before retirement ---
  const effectivePotAtRetirement = plan.total;
  const stopPotToday = discountToToday(effectivePotAtRetirement);
  const alreadyAtTarget = currentPot >= stopPotToday;
  // The target grows at the real rate r each year you keep contributing.
  const targetMilestones = [5, 10]
    .map((n) => currentAge + n)
    .filter((age) => age < retirementAge)
    .map((age) => ({ age, pot: effectivePotAtRetirement / Math.pow(1 + r, retirementAge - age) }));

  // --- Current pot, if contributions stopped today ---
  const projectedPotAtRetirement = currentPot * Math.pow(1 + r, yearsToRetirement);
  const projected = splitPot(projectedPotAtRetirement);
  const depletionAgeCurrentPot = depletionAge(projected.drawdownPot, retirementAge, r, desiredWithdrawalAt);

  // --- Perpetuity pot (infinite drawdown) ---
  // Funds the full income until State Pension age, then the reduced withdrawal forever.
  const yearsBeforeStatePension = includeStatePension ? Math.max(0, spAge - retirementAge) : 0;
  const perpetualWithdrawal = desiredWithdrawalAt(retirementAge + yearsBeforeStatePension);
  const infiniteDrawdownPot =
    r > 0
      ? presentValueOfAnnuity(annualDrawdown, r, yearsBeforeStatePension) +
        perpetualWithdrawal / r / Math.pow(1 + r, yearsBeforeStatePension)
      : Infinity;
  const infinitePotAtRetirement = totalForDrawdownPot(infiniteDrawdownPot);
  const infinitePotToday = discountToToday(infinitePotAtRetirement);

  // --- Chart series (real terms) ---
  const targetSeries = potSeries({
    startAge: currentAge,
    endAge: targetAge,
    startPot: stopPotToday,
    retirementAge,
    lumpSum: plan.lumpSum,
    r,
    withdrawalAt: planWithdrawalAt,
  });
  const currentSeriesEndAge =
    depletionAgeCurrentPot === Infinity
      ? targetAge
      : Math.min(Math.ceil(depletionAgeCurrentPot), targetAge + 5);
  const currentSeries = potSeries({
    startAge: currentAge,
    endAge: currentSeriesEndAge,
    startPot: currentPot,
    retirementAge,
    lumpSum: projected.lumpSum,
    r,
    withdrawalAt: desiredWithdrawalAt,
  });

  return {
    yearsToRetirement,
    yearsInRetirement,
    r, // real growth rate
    r_nominal,
    inflation,

    // State Pension
    includeStatePension,
    statePension,
    statePensionAge: spAge,
    phase1Years: retirementAges.filter((age) => statePensionAt(age) === 0).length,
    phase2Years: retirementAges.filter((age) => statePensionAt(age) > 0).length,

    // Criterion 1
    sufficiencyPotAtRetirement: sufficiency.total,
    sufficiencyPotToday: discountToToday(sufficiency.total),
    sufficiencyLumpSum: sufficiency.lumpSum,

    // Criterion 2
    taxBreachesThreshold,
    firstTaxCappedAge,
    thresholdAtRetirement: thresholdAt(retirementAge),
    taxFreeShare: plan.taxFreeShare,

    // Effective target
    effectivePotAtRetirement,
    triggeringCriterion,
    incomePlan,
    effectiveIncomeFirstYear,

    // Lump sum
    lumpSumPct,
    lumpSumAmount: plan.lumpSum,
    lumpSumCapped: p > 0 && p * plan.total > lumpSumCap,
    drawdownPotAtRetirement: plan.drawdownPot,

    // Depletion ages
    targetAge,
    actualDepletionAge,
    depletionAgeCurrentPot,

    // Stop pot in today's money
    stopPotToday,
    targetMilestones,

    // Current trajectory
    projectedPotAtRetirement,
    projectedLumpSum: projected.lumpSum,

    // Nominal (future £) at retirement
    nominalPotAtRetirement: effectivePotAtRetirement * inflationFactor,
    nominalProjectedPotAtRetirement: projectedPotAtRetirement * inflationFactor,
    nominalIncomeFirstYear: effectiveIncomeFirstYear * inflationFactor,
    nominalThresholdAtRetirement: thresholdAt(retirementAge) * inflationFactor,
    nominalLumpSumAmount: plan.lumpSum * inflationFactor,

    // Perpetuity (infinite drawdown) pot
    infinitePotAtRetirement,
    infinitePotToday,

    // Chart series (real terms)
    targetSeries,
    currentSeries,

    // Final recommendation
    alreadyAtTarget,
  };
}
