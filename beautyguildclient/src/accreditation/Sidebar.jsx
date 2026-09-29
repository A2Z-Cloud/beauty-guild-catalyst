import React, { useEffect, useState } from 'react';
import { LogoutIcon, MenuIcon, CloseIcon, ChevronDownIcon } from './icons';

const NAV_GROUPS = [
  { title: 'Portal', items: ['Dashboard', 'Membership', 'GTi courses', 'Accreditation', 'Insurance'] },
  { title: 'Account', items: ['My profile', 'Documents', 'Invoices'] },
];

const ACTIVE_ITEM = 'Accreditation';

// The Accreditation item's own sub-navigation, once the applicant has a training centre to
// manage - mirrors the old beautyguild.com site's "My Guild Accreditation" expanding into
// its centre-management sections, rather than requiring Dashboard -> Accreditation -> pick
// a school every time just to jump to, say, Invoices.
const SCHOOL_SUB_SECTIONS = [
  { key: 'profile', title: 'Centre profile' },
  { key: 'courses', title: 'Courses' },
  { key: 'sessions', title: 'Course dates' },
  { key: 'venues', title: 'Venues' },
  { key: 'tutors', title: 'Tutors' },
  { key: 'qualifications', title: 'Qualifications' },
  { key: 'documents', title: 'School documents' },
  { key: 'invoices', title: 'Invoices' },
];

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

export default function Sidebar({ contact, onLogout, onDashboard, onAccreditation, onSection, onManageSection, accreditedSchools = [], activeItem = ACTIVE_ITEM }) {
  // Below the 720px breakpoint the sidebar becomes an off-canvas drawer (hidden by
  // default, hamburger-triggered) instead of the desktop's always-visible rail -
  // this state is irrelevant above that breakpoint since the toggle/overlay are
  // hidden there by CSS, but keeping it here avoids prop-drilling through AccreditationApp.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accreditationExpanded, setAccreditationExpanded] = useState(activeItem === 'Accreditation');
  // Auto-open the sub-navigation the first time the applicant actually lands inside
  // Accreditation (e.g. via the dashboard card), rather than only when they use this toggle.
  useEffect(() => {
    if (activeItem === 'Accreditation') setAccreditationExpanded(true);
  }, [activeItem]);

  return (
    <>
      <button type="button" className="acc-sidebar-toggle" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
        <MenuIcon />
      </button>
      {mobileOpen && <div className="acc-sidebar-overlay" onClick={() => setMobileOpen(false)} role="presentation" />}
      <aside className={`acc-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="acc-sidebar-brand">
          <div>
            <div className="acc-sidebar-wordmark">beauty<span className="acc-wordmark-guild">guild</span></div>
            <div className="acc-sidebar-brand-sub">Member portal</div>
          </div>
          <button type="button" className="acc-sidebar-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
            <CloseIcon />
          </button>
        </div>
        <nav className="acc-sidebar-nav">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.title}>
              <div className="acc-sidebar-group-title">{grp.title}</div>
              {grp.items.map((label) => {
                const active = label === activeItem;
                const action = label === 'Dashboard' ? onDashboard : label === 'Accreditation' ? onAccreditation : onSection;
                const clickable = typeof action === 'function';
                const go = () => { setMobileOpen(false); action(label); };
                const showSubNav = label === 'Accreditation' && accreditedSchools.length > 0 && typeof onManageSection === 'function';
                return (
                  <div key={label}>
                    <div
                      className={`acc-sidebar-item${active ? ' active' : ''}${clickable ? ' clickable' : ''}`}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? go : undefined}
                      onKeyDown={clickable ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          go();
                        }
                      } : undefined}
                    >
                      <span className="acc-sidebar-dot" />
                      <span>{label}</span>
                      {showSubNav && (
                        <button
                          type="button"
                          className={`acc-sidebar-expand${accreditationExpanded ? ' open' : ''}`}
                          aria-label={accreditationExpanded ? 'Collapse Accreditation sections' : 'Expand Accreditation sections'}
                          aria-expanded={accreditationExpanded}
                          onClick={(event) => { event.stopPropagation(); setAccreditationExpanded((value) => !value); }}
                        >
                          <ChevronDownIcon />
                        </button>
                      )}
                    </div>
                    {showSubNav && accreditationExpanded && (
                      <div className="acc-sidebar-subnav">
                        {SCHOOL_SUB_SECTIONS.map((section) => {
                          const goSection = () => { setMobileOpen(false); onManageSection(accreditedSchools[0], section.key); };
                          return (
                            <div
                              key={section.key}
                              className="acc-sidebar-subitem clickable"
                              role="button"
                              tabIndex={0}
                              onClick={goSection}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  goSection();
                                }
                              }}
                            >
                              {section.title}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
    </>
  );
}
