import React, { useState } from 'react';
import { findAddresses, retrieveAddress } from '../api';

export default function LoqateAddressLookup({ value, onChange, onSelect, disabled }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (!value.trim()) return;
    setLoading(true); setError('');
    try {
      const results = await findAddresses(value.trim());
      setItems(results);
      if (!results.length) setError('No addresses found. You can enter the address manually.');
    } catch (err) {
      setError(err.message || 'Address search unavailable. You can enter the address manually.');
    } finally { setLoading(false); }
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
          onChange={(e) => { onChange(e.target.value); setItems([]); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="DE23 6AF" disabled={disabled} />
        <button type="button" className="loqate-search-button" onClick={search} disabled={disabled || loading || !value.trim()}>
          {loading ? 'Searching…' : 'Find address'}
        </button>
      </div>
      {error && <div className="loqate-error" role="alert">{error}</div>}
      {items.length > 0 && <div className="loqate-results" role="listbox" aria-label="Address results">
        {items.map((item) => <button key={item.Id} type="button" role="option" aria-selected="false" onClick={() => select(item)}>
          <strong>{item.Text || item.Description}</strong>{item.Description && item.Text && <span>{item.Description}</span>}
        </button>)}
      </div>}
    </div>
  );
}
