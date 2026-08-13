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

  useEffect(() => {
    if (!addressLine || sch.latitude || sch.longitude) return undefined;
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
  }, [addressLine, sch.country, sch.latitude, sch.longitude, setSchField]);

  return (
    <>
      <div>
        <div className="acc-step-heading">Geocoding</div>
        <div className="acc-step-sub">
          Please confirm the training centre location and drag/drop the marker to adjust.<br />
          Click the next button below to save your changes.<br />
          Click the back button below to change your school's address.
        </div>
        <div style={{ fontSize: 12, color: '#A5A0B5', marginTop: 6 }}>Please do not click the back button on your browser.</div>
        {loading && <div style={{ fontSize: 13, color: '#8A8598', marginTop: 10 }}>Locating this address…</div>}
        {error && <div style={{ fontSize: 13, color: '#A33A57', marginTop: 10 }}>{error}</div>}
      </div>
      <div className="acc-card" style={{ padding: 0, overflow: 'hidden' }}>
        <MapPicker latitude={sch.latitude} longitude={sch.longitude} onChange={({ latitude, longitude }) => { setSchField('latitude', latitude); setSchField('longitude', longitude); }} />
      </div>
      <div style={{ fontSize: 12, color: '#8A8598', marginTop: 8 }}>Drag the marker to fine-tune the location. The map position is used for this application only; CRM receives the address fields.</div>
    </>
  );
}
