import React, { useEffect, useState } from 'react';
import { formatUkDate } from './data';
import { BackArrowIcon } from './icons';
import { fetchMembershipInvoices, fetchMembershipExtensions } from './api';
import { SectionHeading, TableShell, ProfileField, InvoiceStatusBadge } from './ManageSchool';

// Branch-type extensions used to be hidden entirely because Membership_Branch could hold a
// broken placeholder string instead of the real branch - the backend now resolves that back
// to a real branch name (or null) itself, so this only has to pick a readable label.
function extensionLabel(ext) {
  if (ext.type === 'Branch') return ext.branch ? `Additional branch — ${ext.branch}` : 'Additional branch (not recorded)';
  return ext.type || 'Not recorded';
}

const OPTIONS = [
  { key: 'details', title: 'Details' },
  { key: 'addons', title: 'Add-ons' },
  { key: 'invoices', title: 'Invoices' },
];

function MembershipContext({ membership }) {
  return (
    <div className="school-context-bar">
      <div><span className="portal-eyebrow">MEMBERSHIP</span><h1>{membership.membershipType || 'Guild membership'}</h1><p>{[membership.branch, membership.subscriptionType].filter(Boolean).join(' · ') || 'Guild membership'}</p></div>
      <div className="school-context-status"><span className={`acc-status-badge${membership.stage === 'Active' ? '' : ' warning'}`}>{membership.stage || 'Unknown'}</span>{membership.expiryDate && <span>Valid until {formatUkDate(membership.expiryDate)}</span>}</div>
    </div>
  );
}

function DetailsDetail({ membership }) {
  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="DETAILS" title="Membership details" description="Everything recorded against this membership." />
      <div className="school-profile-fields">
        <ProfileField label="Status" value={<span className={`acc-status-badge${membership.stage === 'Active' ? '' : ' warning'}`}>{membership.stage || 'Unknown'}</span>} />
        <ProfileField label="Branch" value={membership.branch} />
        <ProfileField label="Billing" value={membership.subscriptionType} />
        <ProfileField label="Start date" value={membership.startDate ? formatUkDate(membership.startDate) : null} />
        <ProfileField label="Expiry date" value={membership.expiryDate ? formatUkDate(membership.expiryDate) : null} />
        <ProfileField label="Amount" value={membership.amount != null ? `£${Number(membership.amount).toFixed(2)}` : null} />
        <ProfileField label="Joining fee" value={membership.joiningFee != null ? `£${Number(membership.joiningFee).toFixed(2)}` : null} />
        <ProfileField label="Payment status" value={membership.paymentStatus} />
        <ProfileField label="Payment method" value={membership.paymentMethod} />
        <ProfileField label="Insurance requested" value={membership.insuranceRequested ? 'Yes' : 'No'} />
        <ProfileField label="Next payment date" value={membership.nextPaymentDate ? formatUkDate(membership.nextPaymentDate) : null} />
        <ProfileField label="Cancellation reason" value={membership.cancellationReason} />
      </div>
    </div>
  );
}

function AddonsDetail({ membership, contactId, contactEmail, contactName }) {
  const [extensions, setExtensions] = useState(null);
  const [error, setError] = useState('');
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const panelRef = React.useRef(null);

  const loadExtensions = () => {
    fetchMembershipExtensions(membership.dealId, contactId)
      .then((result) => setExtensions(result))
      .catch((err) => setError(err.message || 'Addons could not be loaded.'));
  };
  useEffect(() => {
    let cancelled = false;
    fetchMembershipExtensions(membership.dealId, contactId)
      .then((result) => { if (!cancelled) setExtensions(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Addons could not be loaded.'); });
    return () => { cancelled = true; };
  }, [membership.dealId, contactId]);

  // The add-on purchase flow itself is the same vanilla-JS wizard used for membership quotes
  // and renewals (public/membership-quote.js), reused here for just its Add-ons step rather
  // than rebuilt in React - opened via its exposed openAddonPurchase(element) API against a
  // panel this component mounts and hands over. It closes by clearing its own contents and
  // firing beautyguild:addon-purchase-closed, which is how this component knows to hide it.
  useEffect(() => {
    if (!addPanelOpen) return undefined;
    const onClosed = () => { setAddPanelOpen(false); loadExtensions(); };
    window.addEventListener('beautyguild:addon-purchase-closed', onClosed);
    if (panelRef.current && window.BeautyGuildMembershipQuote) {
      window.BeautyGuildMembershipQuote.openAddonPurchase(panelRef.current);
    }
    return () => window.removeEventListener('beautyguild:addon-purchase-closed', onClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPanelOpen]);

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="ADD-ONS" title="Branches & add-ons" description="Additional branches and extras purchased with this membership." />
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {extensions === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading add-ons…</div>
      ) : extensions.length === 0 ? (
        <div className="school-empty"><strong>No add-ons</strong><span>No additional branches or extras were purchased with this membership.</span></div>
      ) : (
        <TableShell><table className="acc-legacy-table">
          <thead><tr><th>Type</th><th>Quantity</th><th>Price</th></tr></thead>
          <tbody>
            {extensions.map((ext) => (
              <tr key={ext.id}>
                <td><strong>{extensionLabel(ext)}</strong></td>
                <td>{ext.quantity ?? '–'}</td>
                <td>{ext.finalPrice != null ? `£${Number(ext.finalPrice).toFixed(2)}` : ext.basePrice != null ? `£${Number(ext.basePrice).toFixed(2)}` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      )}

      {!addPanelOpen && (
        <button type="button" className="acc-btn-secondary" style={{ marginTop: 16, alignSelf: 'flex-start' }} onClick={() => setAddPanelOpen(true)}>
          Add extras
        </button>
      )}
      {addPanelOpen && (
        <div
          ref={panelRef}
          className="membership-addon-panel"
          data-membership-deal-id={membership.dealId}
          data-membership-contact-id={contactId}
          data-membership-contact-email={contactEmail}
          data-membership-contact-name={contactName}
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
}

function InvoicesDetail({ membership, contactId }) {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetchMembershipInvoices(membership.dealId, contactId)
      .then((result) => { if (!cancelled) setInvoices(result); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Invoices could not be loaded.'); });
    return () => { cancelled = true; };
  }, [membership.dealId, contactId]);

  return (
    <div className="school-detail-stack">
      <SectionHeading eyebrow="INVOICES" title="Invoices" description="Invoices raised for this membership." />
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {invoices === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="school-empty"><strong>No invoices yet</strong><span>Invoices will appear here once raised.</span></div>
      ) : (
        <TableShell><table className="acc-legacy-table">
          <thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><strong>#{inv.invoiceNumber}</strong></td>
                <td>{inv.invoiceDate || '–'}</td>
                <td>{inv.dueDate || '–'}</td>
                <td>{inv.amount != null ? `£${inv.amount.toFixed(2)}` : '–'}</td>
                <td><InvoiceStatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table></TableShell>
      )}
    </div>
  );
}

export default function ManageMembership({ membership, contactId, contactEmail, contactName, onBack }) {
  const [activeOption, setActiveOption] = useState('details');
  if (!membership) return null;
  return (
    <div className="acc-body school-workspace">
      <button type="button" className="acc-manage-back-row" onClick={onBack}><BackArrowIcon /><span>Back to membership</span></button>
      <MembershipContext membership={membership} />
      <nav className="school-section-nav" aria-label="Membership sections">
        {OPTIONS.map(({ key, title }) => <button type="button" key={key} className={activeOption === key ? 'active' : ''} aria-current={activeOption === key ? 'page' : undefined} onClick={() => setActiveOption(key)}>{title}</button>)}
      </nav>
      <div className="school-workspace-content" key={activeOption}>
        {activeOption === 'addons' ? <AddonsDetail membership={membership} contactId={contactId} contactEmail={contactEmail} contactName={contactName} />
          : activeOption === 'invoices' ? <InvoicesDetail membership={membership} contactId={contactId} />
          : <DetailsDetail membership={membership} />}
      </div>
    </div>
  );
}
