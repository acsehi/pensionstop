import { HIGHER_RATE_THRESHOLD, STATE_PENSION_AGE } from '../utils/pensionCalc';

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

function fmt(n) {
  return GBP.format(Math.round(n));
}

function fmtAge(age) {
  if (age === Infinity) return 'indefinitely ♾️';
  return `age ${Math.round(age)}`;
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
    phase1Years,
    phase2Years,
    effectiveTaxThresholdPhase2,
    sufficiencyPotAtRetirement,
    taxBreachesThreshold,
    taxPotAtRetirement,
    effectivePotAtRetirement,
    effectiveDrawdown,
    triggeringCriterion,
    lumpSumPct,
    lumpSumAmount,
    lumpSumCapped,
    drawdownPotAtRetirement,
    targetAge,
    actualDepletionAge,
    depletionAgeCurrentPot,
    stopPotToday,
    projectedPotAtRetirement,
    nominalDrawdownAtRetirement,
    nominalThresholdAtRetirement,
    nominalEffectiveDrawdown,
    nominalLumpSumAmount,
    infinitePotAtRetirement,
    infinitePotToday,
    alreadyAtTarget,
  } = result;

  const { currentPot, retirementAge, annualDrawdown, growthRatePct } = inputs;

  // Nominal pot at retirement = real pot × (1 + inflation)^yearsToRetirement
  const nominalPotAtRetirement = Math.round(effectivePotAtRetirement * Math.pow(1 + inflation, yearsToRetirement));
  const nominalStopPotToday = Math.round(stopPotToday); // already in today's money

  const currentDepletionLabel = fmtAge(depletionAgeCurrentPot);

  return (
    <section className="result-panel" aria-label="Results">
      {/* Main recommendation */}
      <div className={`recommendation ${alreadyAtTarget ? 'recommendation--stop' : 'recommendation--continue'}`}>
        {alreadyAtTarget ? (
          <>
            <h2>✅ Stop Contributing Now</h2>
            <p>
              Your current pot of <strong>{fmt(currentPot)}</strong> already meets or exceeds the
              target of <strong>{fmt(stopPotToday)}</strong>. If left to grow at {growthRatePct}%/yr
              it will reach <strong>{fmt(projectedPotAtRetirement)}</strong> by age {retirementAge},
              funding your drawdown until <strong>{currentDepletionLabel}</strong>.
            </p>          </>
        ) : (
          <>
            <h2>🎯 Stop Contributing When Your Pot Reaches</h2>
            <p className="stop-amount">{fmt(stopPotToday)}</p>
            <p className="stop-sub">in today's money &nbsp;·&nbsp; Triggered by: <CriterionBadge criterion={triggeringCriterion} /></p>
            <p>
              The pot will grow to <strong>{fmt(effectivePotAtRetirement)}</strong> by age{' '}
              {retirementAge} (in {yearsToRetirement} yrs){lumpSumPct > 0 && (
                <>, of which <strong>{fmt(lumpSumAmount)}</strong> ({lumpSumPct}%{lumpSumCapped ? ', capped at HMRC limit' : ''}) is taken tax-free,</>
              )} and fund {fmt(effectiveDrawdown)}/yr until <strong>age {targetAge}</strong>.
            </p>
          </>
        )}
      </div>

      {/* Tax warning */}
      {taxBreachesThreshold && (
        <div className="alert alert--warning">
          <strong>⚠️ Tax Band Warning</strong>
          <p>
            Your desired drawdown of <strong>{fmt(annualDrawdown)}/year</strong> exceeds the UK
            higher-rate tax threshold of <strong>{fmt(HIGHER_RATE_THRESHOLD)}/year</strong>. Any
            drawdown above this amount will be taxed at 40%.
          </p>
          <p>
            The stop-pot target has been capped so your retirement income stays within the basic-rate
            band (max {fmt(HIGHER_RATE_THRESHOLD)}/year).
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
              <td>Nominal growth rate</td>
              <td>{(r_nominal * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Inflation rate</td>
              <td>{(inflation * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Real growth rate (used in calculation)</td>
              <td>{(r * 100).toFixed(2)}%</td>
            </tr>
            <tr>
              <td>All monetary figures below are in</td>
              <td><strong>today's money</strong></td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>State Pension</td>
            </tr>
            {includeStatePension ? (
              <>
                <tr>
                  <td>State pension included</td>
                  <td>Yes ✅ (age {STATE_PENSION_AGE})</td>
                </tr>
                <tr>
                  <td>Annual state pension (today's money)</td>
                  <td>{fmt(statePension)}/yr</td>
                </tr>
                <tr>
                  <td>Phase 1: retirement → age {STATE_PENSION_AGE} (no state pension)</td>
                  <td>{phase1Years} yrs — pot funds {fmt(annualDrawdown)}/yr</td>
                </tr>
                <tr>
                  <td>Phase 2: age {STATE_PENSION_AGE} → target age (with state pension)</td>
                  <td>{phase2Years} yrs — pot funds {fmt(Math.max(0, annualDrawdown - statePension))}/yr</td>
                </tr>
                <tr>
                  <td>40% tax threshold for pot drawdown in phase 2</td>
                  <td>{fmt(effectiveTaxThresholdPhase2)}/yr</td>
                </tr>
              </>
            ) : (
              <tr>
                <td>State pension included</td>
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
                <td>Includes tax-free lump sum ({lumpSumPct}%{lumpSumCapped ? ', capped' : ''})</td>
                <td>+ {fmt(lumpSumAmount)}</td>
              </tr>
            )}
            <tr>
              <td>Equivalent pot in today's money</td>
              <td>{fmt(sufficiencyPotAtRetirement / Math.pow(1 + r, yearsToRetirement))}</td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>Criterion 2 – 40% Tax Band</td>
            </tr>
            <tr>
              <td>Drawdown exceeds £50,270 threshold?</td>
              <td>{taxBreachesThreshold ? 'Yes ⚠️' : 'No ✅'}</td>
            </tr>
            {taxBreachesThreshold && (
              <>
                <tr>
                  <td>Max tax-efficient pot at retirement ({fmt(HIGHER_RATE_THRESHOLD)}/yr to age {targetAge})</td>
                  <td>{fmt(taxPotAtRetirement)}</td>
                </tr>
                <tr>
                  <td>Equivalent pot in today's money</td>
                  <td>{fmt(taxPotAtRetirement / Math.pow(1 + r, yearsToRetirement))}</td>
                </tr>
              </>
            )}
            <tr className="section-header">
              <td colSpan={2}>Result</td>
            </tr>
            <tr className="highlight">
              <td>Stop-contributing pot (today's £)</td>
              <td>{fmt(stopPotToday)}</td>
            </tr>
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
                <td>Tax-free lump sum at retirement ({lumpSumPct}%{lumpSumCapped ? ', capped at £268,275' : ''})</td>
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
              <td>Remaining to target</td>
              <td>{alreadyAtTarget ? '—' : fmt(stopPotToday - currentPot)}</td>
            </tr>
            <tr className="section-header">
              <td colSpan={2}>Infinite Drawdown (pot never runs out)</td>
            </tr>
            <tr>
              <td>
                Pot needed at retirement for {fmt(annualDrawdown)}/yr forever
                <br />
                <span style={{ fontSize: '0.82em', color: 'var(--colour-muted, #666)' }}>
                  Annual growth = annual drawdown (real rate {(r * 100).toFixed(2)}%)
                </span>
              </td>
              <td>
                {infinitePotAtRetirement === Infinity ? '∞ (real rate ≈ 0)' : fmt(infinitePotAtRetirement)}
              </td>
            </tr>
            {infinitePotAtRetirement !== Infinity && (
              <tr>
                <td>Equivalent in today's money</td>
                <td>{fmt(infinitePotToday)}</td>
              </tr>
            )}
            <tr>
              <td>Projected pot at retirement (today's £, no more contributions)</td>
              <td>{fmt(projectedPotAtRetirement)}</td>
            </tr>
            <tr>
              <td>Projected pot at retirement (nominal £, no more contributions)</td>
              <td>{fmt(projectedPotAtRetirement * Math.pow(1 + inflation, yearsToRetirement))}</td>
            </tr>
            <tr>
              <td>Current pot funds drawdown until</td>
              <td>{currentDepletionLabel}</td>
            </tr>
            {actualDepletionAge !== Infinity && Math.round(actualDepletionAge) !== targetAge && (
              <tr>
                <td>Actual depletion age (calc check)</td>
                <td>age {Math.round(actualDepletionAge)}</td>
              </tr>
            )}
            <tr className="section-header">
              <td colSpan={2}>At Retirement (Nominal £ — future money)</td>
            </tr>
            <tr>
              <td>Your drawdown in year 1 of retirement (future £)</td>
              <td>{fmt(nominalEffectiveDrawdown)}/yr</td>
            </tr>
            {annualDrawdown > HIGHER_RATE_THRESHOLD ? null : (
              <tr>
                <td>40% tax threshold at retirement (inflation-linked)</td>
                <td>{fmt(nominalThresholdAtRetirement)}/yr</td>
              </tr>
            )}
            {lumpSumPct > 0 && (
              <tr>
                <td>Tax-free lump sum at retirement (future £)</td>
                <td>{fmt(nominalLumpSumAmount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2} style={{ fontStyle: 'italic', fontSize: '0.85em', color: 'var(--colour-muted, #666)' }}>
                Your drawdown grows with inflation each year in retirement, so purchasing power stays constant.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="disclaimer">
        This calculator is for illustrative purposes only. It does not constitute financial advice.
        Tax thresholds are based on UK 2024/25 rates. Stop-pot figures are in today&rsquo;s money
        (real terms). Drawdown is assumed to grow with inflation each year in retirement to maintain
        purchasing power. &ldquo;Indefinitely&rdquo; means annual pot growth covers the drawdown at
        the given real growth rate.
      </p>
    </section>
  );
}
