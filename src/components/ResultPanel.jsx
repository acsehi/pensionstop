import { HIGHER_RATE_THRESHOLD } from '../utils/pensionCalc';

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
    r,
    sufficiencyPotAtRetirement,
    taxBreachesThreshold,
    taxPotAtRetirement,
    effectivePotAtRetirement,
    effectiveDrawdown,
    triggeringCriterion,
    depletionAgeAtTarget,
    depletionAgeCurrentPot,
    stopPotToday,
    projectedPotAtRetirement,
    alreadyAtTarget,
  } = result;

  const { currentPot, retirementAge, annualDrawdown, growthRatePct } = inputs;

  const depletionLabel = fmtAge(depletionAgeAtTarget);
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
            </p>
          </>
        ) : (
          <>
            <h2>🎯 Stop Contributing When Your Pot Reaches</h2>
            <p className="stop-amount">{fmt(stopPotToday)}</p>
            <p className="stop-sub">
              Triggered by: <CriterionBadge criterion={triggeringCriterion} />
            </p>
            <p>
              The pot will grow to <strong>{fmt(effectivePotAtRetirement)}</strong> by age{' '}
              {retirementAge} (in {yearsToRetirement} yrs) and fund{' '}
              {fmt(effectiveDrawdown)}/yr until <strong>{depletionLabel}</strong>.
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
            <tr className="section-header">
              <td colSpan={2}>Criterion 1 – Sufficiency (perpetuity)</td>
            </tr>
            <tr>
              <td>Min pot at retirement to sustain {fmt(annualDrawdown)}/yr indefinitely</td>
              <td>{fmt(sufficiencyPotAtRetirement)}</td>
            </tr>
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
                  <td>Max tax-efficient pot at retirement (sustains {fmt(HIGHER_RATE_THRESHOLD)}/yr)</td>
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
              <td>Stop-contributing pot size (today)</td>
              <td>{fmt(stopPotToday)}</td>
            </tr>
            <tr className="highlight">
              <td>Triggering criterion</td>
              <td><CriterionBadge criterion={triggeringCriterion} /></td>
            </tr>
            <tr className="highlight">
              <td>Money runs out at</td>
              <td>{depletionLabel}</td>
            </tr>
            <tr>
              <td>Your current pot</td>
              <td>{fmt(currentPot)}</td>
            </tr>
            <tr>
              <td>Remaining to target</td>
              <td>{alreadyAtTarget ? '—' : fmt(stopPotToday - currentPot)}</td>
            </tr>
            <tr>
              <td>Projected pot at retirement (no more contributions)</td>
              <td>{fmt(projectedPotAtRetirement)}</td>
            </tr>
            <tr>
              <td>Current pot funds drawdown until</td>
              <td>{currentDepletionLabel}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="disclaimer">
        This calculator is for illustrative purposes only. It does not constitute financial advice.
        Tax thresholds are based on UK 2024/25 rates. Figures are in today's money and do not account
        for inflation. &ldquo;Indefinitely&rdquo; means annual pot growth covers the drawdown at the
        given growth rate.
      </p>
    </section>
  );
}
