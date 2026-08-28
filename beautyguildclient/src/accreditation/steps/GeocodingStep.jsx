import React, { useEffect, useState } from 'react';
import MapPicker from '../components/MapPicker';
import { geocodeAddress } from '../api';

// Real production geocodes the school address via Google Maps with a draggable marker -
// we don't have a Maps API key wired up, so this is a clearly-labelled placeholder.
export default function GeocodingStep({ acc, setSchField }) {
  const sch = acc.sch;
  const addressLine = [sch.l1, sch.town, sch.county, sch.pc, sch.country].filter(Boolean).join(', ');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const resetToAddress = () => {
    setError('');
    setSchField('latitude', null);
    setSchField('longitude', null);
    setRetryKey((value) => value + 1);
  };

  useEffect(() => {
    const hasCoordinates = sch.latitude !== null && sch.latitude !== '' && sch.longitude !== null && sch.longitude !== ''
      && Number.isFinite(Number(sch.latitude)) && Number.isFinite(Number(sch.longitude));
    if (!addressLine || hasCoordinates) return undefined;
    let cancelled = false;
    setLoading(true);
    geocodeAddress(sch.country === 'United Kingdom' ? 'GBR' : sch.country, addressLine)
      .then((coordinates) => {
        if (!cancelled && coordinates) {
          setSchField('latitude', Number(coordinates.latitude));
          setSchField('longitude', Number(coordinates.longitude));
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'We could not geocode this address.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [addressLine, sch.country, sch.latitude, sch.longitude, setSchField, retryKey]);

  return (
    <>
      <div>
        <div className="acc-step-heading">Confirm centre location</div>
        <div className="acc-step-sub">This map shows the approximate location for the address you've entered.</div>
        {loading && <div className="geocode-loading"><span className="acc-spinner" /> Locating this address…</div>}
        {error && <div className="geocode-error" role="alert"><span>{error}</span><button type="button" className="acc-btn-secondary" onClick={() => { setError(''); setRetryKey((value) => value + 1); }}>Try location again</button></div>}
      </div>
      <div className="geocode-address-bar"><div><span>Selected address</span><strong>{addressLine || 'No address supplied'}</strong></div><button type="button" className="text-action" disabled={loading} onClick={resetToAddress}>Re-centre map</button></div>
      <div className="acc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <MapPicker latitude={sch.latitude} longitude={sch.longitude} onChange={({ latitude, longitude }) => { setSchField('latitude', latitude); setSchField('longitude', longitude); }} />
      </div>
      <div className="geocode-help">This map is for your reference only and is not saved with your application.</div>
    </>
  );
}
