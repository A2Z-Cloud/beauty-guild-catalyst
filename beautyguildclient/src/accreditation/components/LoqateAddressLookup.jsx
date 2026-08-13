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
    <div>
      <div style={{ display: 'flex', gap: 9 }}>
        <input className="acc-input" style={{ flex: 1, textTransform: 'uppercase' }} value={value}
          onChange={(e) => { onChange(e.target.value); setItems([]); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="DE23 6AF" disabled={disabled} />
        <button type="button" onClick={search} disabled={disabled || loading || !value.trim()}
          style={{ background: '#16131F', color: '#fff', border: 'none', padding: '0 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', borderRadius: 10, whiteSpace: 'nowrap' }}>
          {loading ? 'Searching…' : 'Find address'}
        </button>
      </div>
      {error && <div style={{ color: '#A33A57', fontSize: 12.5, marginTop: 9 }}>{error}</div>}
      {items.length > 0 && <div style={{ marginTop: 9, border: '1px solid #DCD9E8', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
        {items.map((item) => <button key={item.Id} type="button" onClick={() => select(item)}
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #EEEAF4', background: '#fff', padding: '11px 13px', color: '#28243A', cursor: 'pointer', fontSize: 13 }}>
          <strong>{item.Text || item.Description}</strong>{item.Description && item.Text && <span style={{ color: '#8A8598' }}> — {item.Description}</span>}
        </button>)}
      </div>}
    </div>
  );
}
