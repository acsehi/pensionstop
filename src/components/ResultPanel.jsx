import {
  HIGHER_RATE_THRESHOLD,
  MAX_TAX_FREE_PCT,
  STATE_PENSION_WEEKLY,
  TAX_FREE_LUMP_SUM,
  TAX_YEAR,
} from '../utils/pensionCalc';

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

function fmt(n) {
  return GBP.format(Math.round(n));
}

function pct(x, dp = 1) {
  return `${(x * 100).toFixed(dp)}%`;
}

function untilLabel(age) {
  if (age === Infinity) return 'indefinitely ♾️';
  return `until age ${Math.floor(age + 1e-6)}`;
}

function CriterionBadge({ criterion }) {
  return criterion === 'tax' ? (
    <span className="badge badge--tax">40% Tax Band</span>
  ) : (
    <span className="badge badge--sufficiency">Sufficiency</span>
  );
}

export default function ResultPanel({ result, inputs }) {
  if (!result) return null;

  const {
    yearsToRetirement,
    yearsInRetirement,
    r,
    r_nominal,
    inflation,
    includeStatePension,
    statePension,
    statePensionAge,
    phase1Years,
    phase2Years,
    sufficiencyPotAtRetirement,
    sufficiencyPotToday,
    sufficiencyLumpSum,
    taxBreachesThreshold,
    firstTaxCappedAge,
    thresholdAtRetirement,
    taxFreeShare,
    effectivePotAtRetirement,
    triggeringCriterion,
    effectiveIncomeFirstYear,
    lumpSumPct,
    lumpSumAmount,
    lumpSumCapped,
    drawdownPotAtRetirement,
    targetAge,
    actualDepletionAge,
    depletionAgeCurrentPot,
    stopPotToday,
    targetMilestones,
    projectedPotAtRetirement,
    nominalPotAtRetirement,
    nominalProjectedPotAtRetirement,
    nominalIncomeFirstYear,
    nominalThresholdAtRetirement,
    nominalLumpSumAmount,
    infinitePotAtRetirement,
    infinitePotToday,
    alreadyAtTarget,
  } = result;

  const { currentPot, retirementAge, annualDrawdown } = inputs;

  const incomeLabel = includeStatePension ? 'before tax, including State Pension' : 'before tax';
  const nextMilestone = targetMilestones[0];

  return (
    <section className="result-panel" aria-label="Results">
      {/* Main recommendation */}
      <div className={`recommendation ${alreadyAtTarget ? 'recommendation--stop' : 'recommendation--continue'}`}>
        {alreadyAtTarget ? (
          <>
            <h2>✅ Stop Contributing Now</h2>
            <p>
              Your current pot of <strong>{fmt(currentPot)}</strong> already meets or exceeds the
              target of <strong>{fmt(stopPotToday)}</strong>. Left to grow at {pct(r, 2)}/yr after
              inflation ({pct(r_nominal)} before), it will be worth{' '}
              <strong>{fmt(projectedPotAtRetirement)}</strong> in today&rsquo;s money (
              {fmt(nominalProjectedPotAtRetirement)} in future £) by age {retirementAge}, funding your
              income <strong>{untilLabel(depletionAgeCurrentPot)}</strong>.
            </p>
          </>
        ) : (
          <>
            <h2>🎯 Stop Contributing When Your Pot Reaches</h2>
            <p className="stop-amount">{fmt(stopPotToday)}</p>
            <p className="stop-sub">
              today&rsquo;s target, in today&rsquo;s money &nbsp;·&nbsp; Triggered by:{' '}
              <CriterionBadge criterion={triggeringCriterion} />
            </p>
            <p>
              The target rises by about {pct(r, 2)} a year after inflation while you keep contributing
              {nextMilestone && (
                <>
                  {' '}— e.g. <strong>{fmt(nextMilestone.pot)}</strong> if you stop at age {nextMilestone.age}
                </>
              )}
              . At age {retirementAge} (in {yearsToRetirement} yrs) the pot will be{' '}
              <strong>{fmt(effectivePotAtRetirement)}</strong>
              {lumpSumPct > 0 && (
                <>
                  , of which <strong>{fmt(lumpSumAmount)}</strong> ({lumpSumPct}%
                  {lumpSumCapped ? ', capped at HMRC limit' : ''}) is taken tax-free,
                </>
              )}{' '}
              funding{' '}
              {taxBreachesThreshold ? (
                <>
                  an income capped at <strong>{fmt(effectiveIncomeFirstYear)}/yr</strong> in the first year
                </>
              ) : (
                <>
                  your <strong>{fmt(annualDrawdown)}/yr</strong> income
                </>
              )}{' '}
              ({incomeLabel}) until <strong>age {targetAge}</strong>.
            </p>
          </>
        )}
      </div>

      {/* Tax warning */}
      {taxBreachesThreshold && (
        <div className="alert alert--warning">
          <strong>⚠️ Tax Band Warning</strong>
          <p>
            Your desired income of <strong>{fmt(annualDrawdown)}/year</strong> would push your taxable
            income above the higher-rate threshold
            {firstTaxCappedAge > retirementAge ? ` from age ${firstTaxCappedAge}` : ''}, so part of it
            would be taxed at 40%. The threshold is frozen at {fmt(HIGHER_RATE_THRESHOLD)} until April
            2031 — worth about <strong>{fmt(thresholdAtRetirement)}</strong> in today&rsquo;s money by
            the time you retire.
          </p>
          <p>
            {includeStatePension && (
              <>
                Your State Pension ({fmt(statePension)}/yr from age {statePensionAge}) counts towards the
                threshold.{' '}
              </>
            )}
            {taxFreeShare > 0 ? (
              <>
                {pct(taxFreeShare)} of each pension withdrawal is tax-free (the tax-free cash you
                don&rsquo;t take upfront), so that part doesn&rsquo;t count.
              </>
            ) : (
              <>Pension withdrawals are fully taxable because your tax-free cash is taken upfront.</>
            )}
          </p>
          <p>
            The stop-pot target has been capped so your taxable income stays within the basic-rate band
            — an income of {fmt(effectiveIncomeFirstYear)}/yr in your first year of retirement.
          </p>
        </div>
      )}

      {/* Breakdown table */}
      <div className="breakdown">
        <h3>Calculation Breakdown</h3>
        <table>
          <tbody>
            <tr>
              <td>Years to retirement</td>
              <td>{yearsToRetirement}</td>
            </tr>
            <tr>
              <td>Years in retirement (to target age {targetAge})</td>
              <td>{yearsInRetirement}</td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>Inflation Adjustment</td>
            </tr>
            <tr>
              <td>Nominal growth rate (after fees)</td>
              <td>{pct(r_nominal)}</td>
            </tr>
            <tr>
              <td>Inflation rate</td>
              <td>{pct(inflation)}</td>
            </tr>
            <tr>
              <td>Real growth rate (used in calculation)</td>
              <td>{pct(r, 2)}</td>
            </tr>
            <tr>
              <td>All monetary figures below are in</td>
              <td><strong>today&rsquo;s money</strong></td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>State Pension</td>
            </tr>
            {includeStatePension ? (
              <>
                <tr>
                  <td>State Pension included</td>
                  <td>Yes ✅ (from age {statePensionAge})</td>
                </tr>
                <tr>
                  <td>Annual State Pension (today&rsquo;s money)</td>
                  <td>{fmt(statePension)}/yr</td>
                </tr>
                <tr>
                  <td>Phase 1: retirement → age {statePensionAge} (no State Pension)</td>
                  <td>{phase1Years} yrs — pot funds {fmt(annualDrawdown)}/yr</td>
                </tr>
                <tr>
                  <td>Phase 2: age {statePensionAge} → target age (with State Pension)</td>
                  <td>{phase2Years} yrs — pot funds {fmt(Math.max(0, annualDrawdown - statePension))}/yr</td>
                </tr>
              </>
            ) : (
              <tr>
                <td>State Pension included</td>
                <td>No ☐</td>
              </tr>
            )}
            <tr className="section-header">
              <td colSpan={2}>Criterion 1 – Sufficiency</td>
            </tr>
            <tr>
              <td>Pot needed at retirement to fund {fmt(annualDrawdown)}/yr until age {targetAge}</td>
              <td>{fmt(sufficiencyPotAtRetirement)}</td>
            </tr>
            {lumpSumPct > 0 && (
              <tr>
                <td>
                  Includes tax-free lump sum ({lumpSumPct}%
                  {(lumpSumPct / 100) * sufficiencyPotAtRetirement > sufficiencyLumpSum + 0.5 ? ', capped' : ''})
                </td>
                <td>+ {fmt(sufficiencyLumpSum)}</td>
              </tr>
            )}
            <tr>
              <td>Equivalent pot in today&rsquo;s money</td>
              <td>{fmt(sufficiencyPotToday)}</td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>Criterion 2 – 40% Tax Band</td>
            </tr>
            <tr>
              <td>
                Higher-rate threshold at retirement (today&rsquo;s £)
                <br />
                <span className="cell-note">
                  Frozen at {fmt(HIGHER_RATE_THRESHOLD)} until April 2031, then assumed to rise with inflation
                </span>
              </td>
              <td>{fmt(thresholdAtRetirement)}/yr</td>
            </tr>
            <tr>
              <td>Tax-free share of each pension withdrawal</td>
              <td>{pct(taxFreeShare)}</td>
            </tr>
            <tr>
              <td>Desired income pushes taxable income over the threshold?</td>
              <td>
                {taxBreachesThreshold
                  ? `Yes ⚠️${firstTaxCappedAge > retirementAge ? ` (from age ${firstTaxCappedAge})` : ''}`
                  : 'No ✅'}
              </td>
            </tr>
            {taxBreachesThreshold && (
              <>
                <tr>
                  <td>Max tax-efficient pot at retirement</td>
                  <td>{fmt(effectivePotAtRetirement)}</td>
                </tr>
                <tr>
                  <td>Equivalent pot in today&rsquo;s money</td>
                  <td>{fmt(stopPotToday)}</td>
                </tr>
              </>
            )}
            <tr className="section-header">
              <td colSpan={2}>Result</td>
            </tr>
            <tr className="highlight">
              <td>Stop-contributing pot today (today&rsquo;s £)</td>
              <td>{fmt(stopPotToday)}</td>
            </tr>
            {targetMilestones.map(({ age, pot }) => (
              <tr key={age}>
                <td>Target if you stop at age {age} instead (today&rsquo;s £)</td>
                <td>{fmt(pot)}</td>
              </tr>
            ))}
            <tr>
              <td>Equivalent nominal pot at retirement</td>
              <td>{fmt(nominalPotAtRetirement)}</td>
            </tr>
            <tr className="highlight">
              <td>Triggering criterion</td>
              <td><CriterionBadge criterion={triggeringCriterion} /></td>
            </tr>
            <tr className="highlight">
              <td>Target: money runs out at</td>
              <td>age {targetAge}</td>
            </tr>
            {lumpSumPct > 0 && (
              <tr>
                <td>
                  Tax-free lump sum at retirement ({lumpSumPct}%
                  {lumpSumCapped ? `, capped at ${fmt(TAX_FREE_LUMP_SUM)} in future £` : ''})
                </td>
                <td>{fmt(lumpSumAmount)}</td>
              </tr>
            )}
            {lumpSumPct > 0 && (
              <tr>
                <td>Pot remaining for drawdown after lump sum</td>
                <td>{fmt(drawdownPotAtRetirement)}</td>
              </tr>
            )}
            <tr>
              <td>Your current pot</td>
              <td>{fmt(currentPot)}</td>
            </tr>
            <tr>
              <td>Shortfall against today&rsquo;s target</td>
              <td>{alreadyAtTarget ? '—' : fmt(stopPotToday - currentPot)}</td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>Infinite Drawdown (pot never runs out)</td>
            </tr>
            <tr>
              <td>
                Pot needed at retirement for {fmt(annualDrawdown)}/yr income forever
                <br />
                <span className="cell-note">
                  Growth covers withdrawals{includeStatePension ? ' once State Pension starts' : ''} (real
                  rate {pct(r, 2)}){lumpSumPct > 0 ? '; includes tax-free lump sum' : ''}
                </span>
              </td>
              <td>
                {infinitePotAtRetirement === Infinity ? '∞ (real rate ≈ 0)' : fmt(infinitePotAtRetirement)}
              </td>
            </tr>
            {infinitePotAtRetirement !== Infinity && (
              <tr>
                <td>Equivalent in today&rsquo;s money</td>
                <td>{fmt(infinitePotToday)}</td>
              </tr>
            )}
            <tr>
              <td>Projected pot at retirement (today&rsquo;s £, no more contributions)</td>
              <td>{fmt(projectedPotAtRetirement)}</td>
            </tr>
            <tr>
              <td>Projected pot at retirement (nominal £, no more contributions)</td>
              <td>{fmt(nominalProjectedPotAtRetirement)}</td>
            </tr>
            <tr>
              <td>Current pot funds your {fmt(annualDrawdown)}/yr income</td>
              <td>{untilLabel(depletionAgeCurrentPot)}</td>
            </tr>
            {actualDepletionAge !== Infinity && Math.abs(actualDepletionAge - targetAge) > 0.5 && (
              <tr>
                <td>Actual depletion age (calc check)</td>
                <td>age {Math.floor(actualDepletionAge + 1e-6)}</td>
              </tr>
            )}
            <tr className="section-header">
              <td colSpan={2}>At Retirement (Nominal £ — future money)</td>
            </tr>
            <tr>
              <td>Your income in year 1 of retirement (future £)</td>
              <td>{fmt(nominalIncomeFirstYear)}/yr</td>
            </tr>
            <tr>
              <td>Higher-rate threshold at retirement (future £)</td>
              <td>{fmt(nominalThresholdAtRetirement)}/yr</td>
            </tr>
            {lumpSumPct > 0 && (
              <tr>
                <td>Tax-free lump sum at retirement (future £)</td>
                <td>{fmt(nominalLumpSumAmount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2} className="cell-note">
                Your income is assumed to rise with inflation each year in retirement, so its purchasing
                power stays constant.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="assumptions">
        <summary>Assumptions</summary>
        <ul>
          <li>
            Figures are in today&rsquo;s money unless marked &ldquo;future £&rdquo;. The growth rate is
            the nominal return after fees; calculations use the real (after-inflation) rate.
          </li>
          <li>
            Income is before tax and includes the State Pension when ticked. Withdrawals are taken once
            a year and the pot is used up at the target age. No further contributions are made after
            stopping.
          </li>
          <li>
            State Pension: the full new State Pension of £{STATE_PENSION_WEEKLY.toFixed(2)}/week (
            {TAX_YEAR}), which needs 35 qualifying National Insurance years. It is assumed to rise with
            inflation (the triple lock may do better). State Pension age is estimated from your current
            age under current law (66, 67 or 68); transitional birth dates are rounded up.
          </li>
          <li>
            Tax: the {fmt(HIGHER_RATE_THRESHOLD)} higher-rate threshold (England, Wales and Northern
            Ireland — Scottish bands aren&rsquo;t modelled) is frozen until April 2031 and then assumed
            to rise with inflation. The Personal Allowance taper above £100,000 isn&rsquo;t modelled.
          </li>
          <li>
            Tax-free cash: up to {MAX_TAX_FREE_PCT}% of the pot, capped by the {fmt(TAX_FREE_LUMP_SUM)}{' '}
            Lump Sum Allowance, which is fixed in cash terms. Any tax-free cash not taken upfront is
            assumed to be spread across withdrawals (UFPLS-style).
          </li>
          <li>
            Minimum pension age: 55, rising to 57 from 6 April 2028. Protected pension ages
            aren&rsquo;t modelled.
          </li>
          <li>
            The 40% cap is a rule of thumb. It ignores tax relief on contributions, employer
            contributions, salary sacrifice savings and investment volatility — if you get 40% relief or
            employer contributions now, contributing beyond the cap can still pay off.
          </li>
        </ul>
      </details>

      <p className="disclaimer">
        This calculator is for illustrative purposes only. It does not constitute financial advice.
      </p>
    </section>
  );
}
