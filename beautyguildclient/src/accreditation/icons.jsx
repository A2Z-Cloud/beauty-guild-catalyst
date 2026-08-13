import React from 'react';

const base = { width: 32, height: 32, viewBox: '0 0 24 24', fill: 'none', stroke: '#16131F', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function DocumentIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21V3a.5.5 0 0 1 .5-.5z" />
      <path d="M14 2.5V7h4" />
      <path d="M8.5 12h7M8.5 15h7M8.5 18h4.5" />
    </svg>
  );
}

export function GraduationCapIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5z" />
      <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
      <path d="M20.5 10v6" />
    </svg>
  );
}

export function PeopleIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.4" />
      <path d="M2.5 19.5c0-3 2.7-5.2 6-5.2s6 2.2 6 5.2" />
      <path d="M14.5 14.7c2.6.2 4.5 2.2 4.5 4.8" />
    </svg>
  );
}

export function PencilSquareIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M9 15l1-3.2 6.2-6.2a1.4 1.4 0 0 1 2 2L12 14l-3 1z" />
    </svg>
  );
}

export function CertificateIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="1.5" />
      <circle cx="12" cy="10.5" r="2.6" />
      <path d="M9.8 20.5l1-3 1.2 1 1.2-1 1 3" />
    </svg>
  );
}

export function LogoutIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5.5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function BackArrowIcon(props) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16131F" strokeWidth="1.4" {...props}>
      <circle cx="12" cy="12" r="10.3" />
      <path d="M13 8l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
