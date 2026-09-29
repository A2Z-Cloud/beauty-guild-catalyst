import React, { useState, useEffect, useRef } from 'react';
import { findAddresses, retrieveAddress } from '../api';

// Minimum characters before an auto-search fires, and how long to wait after the user
// stops typing - short enough to feel live, long enough not to fire a Loqate request on
// every keystroke while someone is still typing "320 Burton Road".
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

export default function LoqateAddressLookup({ value, onChange, onSelect, disabled }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const runSearch = async (query) => {
    const requestId = ++requestIdRef.current;
    setLoading(true); setError('');
    try {
      const results = await findAddresses(query.trim());
      if (requestId !== requestIdRef.current) return; // a newer keystroke has since fired
      // A postcode-only search almost always comes back as a single "container" row (e.g.
      // "47 Addresses") rather than the addresses themselves. Leaving that as the only
      // thing on screen made it too easy to click it without realising it wasn't actually
      // an address yet - drilling into it immediately shows the real, selectable list
      // straight away instead.
      if (results.length === 1 && results[0].Type && results[0].Type !== 'Address') {
        await select(results[0]);
        return;
      }
      setItems(results);
      if (!results.length) setError('No addresses found. You can enter the address manually.');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message || 'Address search unavailable. You can enter the address manually.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const search = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim()) runSearch(value);
  };

  const handleChange = (nextValue) => {
    onChange(nextValue);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = nextValue.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) { setItems([]); return; }
    // Debounced auto-search - addresses pop up while typing rather than requiring an
    // explicit "Find address" click for every search.
    debounceRef.current = setTimeout(() => runSearch(nextValue), DEBOUNCE_MS);
  };

  const select = async (item) => {
    setLoading(true); setError('');
    try {
      if (item.Type && item.Type !== 'Address') {
        setItems(await findAddresses(item.Text || item.Description, item.Id));
      } else {
        const address = await retrieveAddress(item.Id);
        if (address) onSelect(address);
        setItems([]);
      }
    } catch (err) {
      setError(err.message || 'Unable to retrieve that address.');
    } finally { setLoading(false); }
  };

  return (
    <div className="loqate-lookup">
      <div className="loqate-search-row">
        <input className="acc-input" value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="e.g. AB1 2CD, or start typing your address" disabled={disabled} />
        <button type="button" className="loqate-search-button" onClick={search} disabled={disabled || loading || !value.trim()}>
          {loading ? 'Searching…' : 'Find address'}
        </button>
      </div>
      {error && <div className="loqate-error" role="alert">{error}</div>}
      {items.length > 0 && <div className="loqate-results" role="listbox" aria-label="Address results">
        {items.map((item) => {
          // A "container" row (a street/locality still holding several addresses) needs
          // drilling into before it's a real, selectable address - marked distinctly so it's
          // never mistaken for one, per the earlier "too easy to click the first result"
          // feedback.
          const isContainer = item.Type && item.Type !== 'Address';
          return (
            <button key={item.Id} type="button" className={isContainer ? 'loqate-result-container' : undefined} role="option" aria-selected="false" onClick={() => select(item)}>
              <span>
                <strong>{item.Text || item.Description}</strong>
                {item.Description && item.Text && <span>{item.Description}</span>}
              </span>
              {isContainer && <span className="loqate-result-expand" aria-hidden="true">Select to view addresses ›</span>}
            </button>
          );
        })}
      </div>}
    </div>
  );
}
