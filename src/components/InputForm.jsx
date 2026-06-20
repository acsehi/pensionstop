import { useState } from 'react';

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const fmt = (n) => GBP.format(Math.round(n));

const MAX_LUMP_SUM_PCT = 25;

const DEFAULTS = {
  currentAge: '41',
  currentPot: '450000',
  retirementAge: '58',
  targetAge: '90',
  annualDrawdown: '50000',
  growthRatePct: '5',
  lumpSumPct: '25',
};

const FIELDS = [
  {
    id: 'currentAge',
    label: 'Your current age',
    type: 'number',
    min: 16,
    max: 74,
    placeholder: 'e.g. 35',
    unit: 'years',
  },
  {
    id: 'currentPot',
    label: 'Current pension pot size',
    type: 'number',
    min: 0,
    placeholder: 'e.g. 50000',
    unit: '£',
    prefix: true,
  },
  {
    id: 'retirementAge',
    label: 'Planned retirement age',
    type: 'number',
    min: 55,
    max: 90,
    placeholder: 'e.g. 67',
    unit: 'years',
  },
  {
    id: 'targetAge',
    label: 'Target age when money runs out',
    type: 'number',
    min: 56,
    max: 120,
    placeholder: 'e.g. 90',
    unit: 'years',
  },
  {
    id: 'annualDrawdown',
    label: 'Expected annual drawdown in retirement',
    type: 'number',
    min: 1,
    placeholder: 'e.g. 25000',
    unit: '£/year',
    prefix: true,
  },
  {
    id: 'growthRatePct',
    label: 'Expected pension pot growth rate',
    type: 'number',
    min: 0,
    max: 30,
    step: 0.1,
    placeholder: 'e.g. 5',
    unit: '%/year',
    suffix: true,
  },
];

export default function InputForm({ onCalculate }) {
  const [values, setValues] = useState(DEFAULTS);
  const [errors, setErrors] = useState({});

  function validate(vals) {
    const errs = {};
    const age = Number(vals.currentAge);
    const retAge = Number(vals.retirementAge);
    const targetAge = Number(vals.targetAge);
    const pot = Number(vals.currentPot);
    const drawdown = Number(vals.annualDrawdown);
    const rate = Number(vals.growthRatePct);
    const ls = vals.lumpSumPct === '' ? 0 : Number(vals.lumpSumPct);

    if (!vals.currentAge || isNaN(age) || age < 16 || age > 74)
      errs.currentAge = 'Enter an age between 16 and 74.';
    if (!vals.retirementAge || isNaN(retAge) || retAge < 55 || retAge > 90)
      errs.retirementAge = 'Enter a retirement age between 55 and 90.';
    if (!errs.currentAge && !errs.retirementAge && retAge <= age)
      errs.retirementAge = 'Retirement age must be greater than your current age.';
    if (!vals.targetAge || isNaN(targetAge) || targetAge < 56 || targetAge > 120)
      errs.targetAge = 'Enter a target age between 56 and 120.';
    if (!errs.retirementAge && !errs.targetAge && targetAge <= retAge)
      errs.targetAge = 'Target age must be greater than your retirement age.';
    if (vals.currentPot === '' || isNaN(pot) || pot < 0)
      errs.currentPot = 'Enter a valid pot size (0 or more).';
    if (!vals.annualDrawdown || isNaN(drawdown) || drawdown <= 0)
      errs.annualDrawdown = 'Enter a positive annual drawdown amount.';
    if (vals.growthRatePct === '' || isNaN(rate) || rate < 0 || rate > 30)
      errs.growthRatePct = 'Enter a growth rate between 0% and 30%.';

    if (vals.lumpSumPct !== '' && !isNaN(ls)) {
      if (ls < 0 || ls > MAX_LUMP_SUM_PCT)
        errs.lumpSumPct = 'Enter a percentage between 0 and 25.';
    }

    return errs;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onCalculate({
      currentAge: Number(values.currentAge),
      currentPot: Number(values.currentPot),
      retirementAge: Number(values.retirementAge),
      targetAge: Number(values.targetAge),
      annualDrawdown: Number(values.annualDrawdown),
      growthRatePct: Number(values.growthRatePct),
      lumpSumPct: values.lumpSumPct === '' ? 0 : Number(values.lumpSumPct),
    });
  }

  return (
    <form className="input-form" onSubmit={handleSubmit} noValidate>
      {FIELDS.map(({ id, label, type, min, max, step, placeholder, unit, prefix, suffix }) => (
        <div key={id} className={`field${errors[id] ? ' field--error' : ''}`}>
          <label htmlFor={id}>{label}</label>
          <div className="input-wrapper">
            {prefix && <span className="input-adornment input-adornment--prefix">£</span>}
            <input
              id={id}
              name={id}
              type={type}
              min={min}
              max={max}
              step={step ?? 1}
              placeholder={placeholder}
              value={values[id]}
              onChange={handleChange}
              aria-describedby={errors[id] ? `${id}-error` : undefined}
            />
            {!prefix && <span className="input-adornment input-adornment--suffix">{unit}</span>}
            {suffix && <span className="input-adornment input-adornment--suffix">%</span>}
          </div>
          {errors[id] && (
            <p id={`${id}-error`} className="field-error" role="alert">
              {errors[id]}
            </p>
          )}
        </div>
      ))}

      {/* Tax-free lump sum */}
      <div className={`field${errors.lumpSumPct ? ' field--error' : ''}`}>
        <label htmlFor="lumpSumPct">
          Tax-free lump sum at retirement{' '}
          <span className="label-hint">(optional — max 25%, capped at £268,275)</span>
        </label>
        <div className="input-wrapper">
          <input
            id="lumpSumPct"
            name="lumpSumPct"
            type="number"
            min={0}
            max={25}
            step={1}
            placeholder="e.g. 25 (leave blank for none)"
            value={values.lumpSumPct}
            onChange={handleChange}
            aria-describedby={errors.lumpSumPct ? 'lumpSumPct-error' : undefined}
          />
          <span className="input-adornment input-adornment--suffix">%</span>
        </div>
        {errors.lumpSumPct && (
          <p id="lumpSumPct-error" className="field-error" role="alert">
            {errors.lumpSumPct}
          </p>
        )}
      </div>

      <button type="submit" className="btn-calculate">
        Calculate
      </button>
    </form>
  );
}
