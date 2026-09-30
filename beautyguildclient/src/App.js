import AccreditationApp from './accreditation/AccreditationApp';
import InsuranceApp from './insurance/InsuranceApp';

function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('insuranceQuote') === '1') {
    return <InsuranceApp publicEntry />;
  }
  return <AccreditationApp />;
}

export default App;
