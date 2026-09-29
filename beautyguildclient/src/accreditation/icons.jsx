import React from 'react';

const base = { width: 32, height: 32, viewBox: '0 0 24 24', fill: 'none', stroke: '#000', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };

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

export function PersonIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-3.6 3.4-6.2 7.5-6.2s7.5 2.6 7.5 6.2" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21" />
      <path d="M15 10h3.5A1.5 1.5 0 0 1 20 11.5V21" />
      <path d="M5 21h15" />
      <path d="M8 7h1.5M11.5 7H13M8 11h1.5M11.5 11H13M8 15h1.5M11.5 15H13" />
    </svg>
  );
}

export function ShieldIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.8 19.5 6v6c0 5-3.2 8-7.5 9-4.3-1-7.5-4-7.5-9V6L12 2.8z" />
      <path d="M9 12l2 2 4-4.5" />
    </svg>
  );
}

export function HouseUsersIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v9.5A1 1 0 0 0 6.5 20.5h11a1 1 0 0 0 1-1V10" />
      <circle cx="9.5" cy="14.5" r="1.6" />
      <circle cx="14.5" cy="15" r="1.3" />
      <path d="M7 19v-.8c0-1.6 1.1-2.7 2.5-2.7s2.5 1.1 2.5 2.7V19" />
      <path d="M13 19v-.5c0-1.2.9-2.1 2-2.1s2 .9 2 2.1V19" />
    </svg>
  );
}

export function CardIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="1.8" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </svg>
  );
}

export function TargetArrowIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="10.5" cy="13.5" r="7.3" />
      <circle cx="10.5" cy="13.5" r="3.4" />
      <path d="M14 10 21 3" />
      <path d="M16.5 3H21v4.5" />
    </svg>
  );
}

export function MegaphoneIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10v4a1.5 1.5 0 0 0 1.5 1.5H6l1 4.5" />
      <path d="M6 10 18 4v16L6 14" />
      <path d="M18 8.5c1.4.6 2.3 1.9 2.3 3.5s-.9 2.9-2.3 3.5" />
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

export function MenuIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

export function BackArrowIcon(props) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.4" {...props}>
      <circle cx="12" cy="12" r="10.3" />
      <path d="M13 8l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronDownIcon(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
