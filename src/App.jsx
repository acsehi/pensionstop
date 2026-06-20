import { useState } from 'react';
import InputForm from './components/InputForm';
import ResultPanel from './components/ResultPanel';
import { calculatePensionStop } from './utils/pensionCalc';
import './styles/app.css';

export default function App() {
  const [result, setResult] = useState(null);
  const [lastInputs, setLastInputs] = useState(null);

  function handleCalculate(inputs) {
    setLastInputs(inputs);
    setResult(calculatePensionStop(inputs));
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏦 PensionStop</h1>
        <p className="tagline">Find out when you should stop contributing to your UK pension</p>
      </header>

      <main className="app-main">
        <section className="form-section">
          <h2>Your Details</h2>
          <InputForm onCalculate={handleCalculate} />
        </section>

        {result && (
          <div id="results">
            <ResultPanel result={result} inputs={lastInputs} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Based on UK 2024/25 tax thresholds · Not financial advice</p>
      </footer>
    </div>
  );
}
