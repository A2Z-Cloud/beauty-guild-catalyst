import React from 'react';
import { LogoutIcon } from './icons';

const NAV_GROUPS = [
  { title: 'Portal', items: ['Dashboard', 'Membership', 'GTi courses', 'Accreditation', 'Insurance'] },
  { title: 'Account', items: ['My profile', 'Documents'] },
];

const ACTIVE_ITEM = 'Accreditation';

function userDisplayName(contact) {
  const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim();
  return name || contact?.email || 'Guest';
}

function userInitials(contact) {
  const first = contact?.firstName?.[0];
  const last = contact?.lastName?.[0];
  if (first || last) return `${first || ''}${last || ''}`.toUpperCase();
  return (contact?.email || '?').slice(0, 2).toUpperCase();
}

export default function Sidebar({ contact, onLogout, onDashboard, onAccreditation, onSection, activeItem = ACTIVE_ITEM }) {
  return (
    <aside className="acc-sidebar">
      <div className="acc-sidebar-brand">
        <div className="acc-sidebar-logo">g</div>
        <div>
          <div className="acc-sidebar-brand-name">beautyguild</div>
          <div className="acc-sidebar-brand-sub">Member portal</div>
        </div>
      </div>
      <nav className="acc-sidebar-nav">
        {NAV_GROUPS.map((grp) => (
          <div key={grp.title}>
            <div className="acc-sidebar-group-title">{grp.title}</div>
            {grp.items.map((label) => {
              const active = label === activeItem;
              const action = label === 'Dashboard' ? onDashboard : label === 'Accreditation' ? onAccreditation : onSection;
              const clickable = typeof action === 'function';
              return (
                <div
                  key={label}
                  className={`acc-sidebar-item${active ? ' active' : ''}${clickable ? ' clickable' : ''}`}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => action(label) : undefined}
                  onKeyDown={clickable ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      action(label);
                    }
                  } : undefined}
                >
                  <span className="acc-sidebar-dot" />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      {contact && (
        <div className="acc-sidebar-user">
          <div className="acc-sidebar-avatar">{userInitials(contact)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="acc-sidebar-user-name" title={userDisplayName(contact)}>{userDisplayName(contact)}</div>
            <div className="acc-sidebar-user-role" title={contact.email}>{contact.email}</div>
          </div>
          <button type="button" className="acc-sidebar-logout" onClick={onLogout} title="Log out">
            <LogoutIcon />
          </button>
        </div>
      )}
    </aside>
  );
}
