import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const GBP_FULL = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function buildSeries({ startAge, startPot, retirementAge, targetAge, growthRate, annualDrawdown, lumpSumAmount }) {
  const data = [];
  let pot = startPot;

  for (let age = startAge; age <= targetAge; age++) {
    data.push({ age, pot: Math.max(0, Math.round(pot)) });

    if (age < retirementAge) {
      // Accumulation phase
      pot *= (1 + growthRate);
    } else if (age === retirementAge) {
      // Take lump sum at retirement
      pot -= lumpSumAmount;
      pot = Math.max(0, pot);
      pot = pot * (1 + growthRate) - annualDrawdown;
    } else {
      // Drawdown phase
      pot = pot * (1 + growthRate) - annualDrawdown;
    }

    if (pot < 0) pot = 0;
  }

  return data;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-age">Age {label}</p>
      {payload.map((entry) => (
        entry.value != null && (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {GBP_FULL.format(entry.value)}
          </p>
        )
      ))}
    </div>
  );
}

export default function PotChart({ result, inputs }) {
  if (!result) return null;

  const {
    r,
    r_nominal,
    inflation,
    stopPotToday,
    lumpSumAmount,
    effectiveDrawdown,
    depletionAgeCurrentPot,
    targetAge,
  } = result;

  const { currentAge, currentPot, retirementAge, annualDrawdown } = inputs;

  // Real series: pot in today's money (uses r_real = r)
  const targetRealSeries = buildSeries({
    startAge: currentAge,
    startPot: stopPotToday,
    retirementAge,
    targetAge,
    growthRate: r,
    annualDrawdown: effectiveDrawdown,
    lumpSumAmount,
  });

  const currentEndAge = depletionAgeCurrentPot === Infinity
    ? targetAge
    : Math.min(Math.ceil(depletionAgeCurrentPot), targetAge + 5);

  const currentRealSeries = buildSeries({
    startAge: currentAge,
    startPot: currentPot,
    retirementAge,
    targetAge: currentEndAge,
    growthRate: r,
    annualDrawdown,
    lumpSumAmount,
  });

  // Nominal series: real × (1 + inflation)^(age - currentAge)
  const toNominal = (realPot, age) =>
    realPot === null ? null : Math.round(realPot * Math.pow(1 + inflation, age - currentAge));

  // Merge into single dataset keyed by age
  const ages = Array.from(
    new Set([...targetRealSeries.map(d => d.age), ...currentRealSeries.map(d => d.age)])
  ).sort((a, b) => a - b);

  const targetRealMap = Object.fromEntries(targetRealSeries.map(d => [d.age, d.pot]));
  const currentRealMap = Object.fromEntries(currentRealSeries.map(d => [d.age, d.pot]));

  const chartData = ages.map(age => {
    const targetReal = targetRealMap[age] ?? null;
    const currentReal = currentRealMap[age] ?? null;
    return {
      age,
      targetReal,
      targetNominal: toNominal(targetReal, age),
      currentReal,
      currentNominal: toNominal(currentReal, age),
    };
  });

  const fmtStop = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(stopPotToday);

  return (
    <div className="chart-section">
      <h3>Pot Size Over Time</h3>
      <p className="chart-subtitle">
        <span className="legend-dot" style={{ background: '#2a52a4' }} /> Target – real (today's £)
        &nbsp;·&nbsp;
        <span className="legend-dot" style={{ background: '#7b9de0' }} /> Target – nominal (actual £)
        &nbsp;·&nbsp;
        <span className="legend-dot" style={{ background: '#00a878' }} /> Current pot – real
        &nbsp;·&nbsp;
        <span className="legend-dot" style={{ background: '#66d4b0' }} /> Current pot – nominal
        &nbsp;·&nbsp; Stop at {fmtStop} (today's £)
      </p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ef" />
          <XAxis
            dataKey="age"
            label={{ value: 'Age', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v) => GBP.format(v)}
            tick={{ fontSize: 11 }}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={retirementAge} stroke="#e05c2a" strokeDasharray="4 3" label={{ value: `Retire ${retirementAge}`, position: 'top', fontSize: 11, fill: '#e05c2a' }} />
          <Line type="monotone" dataKey="targetReal"    name="Target (today's £)"  stroke="#2a52a4" strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="targetNominal" name="Target (nominal £)"   stroke="#7b9de0" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="currentReal"   name="Current (today's £)"  stroke="#00a878" strokeWidth={2}   strokeDasharray="6 3" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="currentNominal" name="Current (nominal £)" stroke="#66d4b0" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
