import React, { useEffect, useState } from 'react';
import { documentThumbnailUrl } from './api';

const FILE_ICONS = {
  folder: '📁', image: '🖼️', pdf: '📕', text: '📄', doc: '📄',
  sheet: '📊', presentation: '📽️', zip: '🗜️', audio: '🎵', video: '🎬',
};

export function fileIcon(iconClass, isFolder) {
  return FILE_ICONS[iconClass] || (isFolder ? '📁' : '📄');
}

export function timeAgo(ms) {
  if (!ms) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [label, secs] of units) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count === 1 ? '' : 's'} ago`;
  }
  return 'Just now';
}

export function DocumentThumbnail({ item }) {
  const [failed, setFailed] = useState(false);
  if (item.isFolder || failed) return <span className="document-card-icon">{fileIcon(item.iconClass, item.isFolder)}</span>;
  return (
    <img
      className="document-card-thumb"
      src={documentThumbnailUrl(item.id)}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

// Generic WorkDrive folder browser: fetchPage(folderId) resolves { items, message }.
// deps are the identity inputs (e.g. accreditationId/contactId) fetchPage closes over -
// passed separately rather than depending on fetchPage itself, since callers would
// otherwise need to memoize a fresh function on every render to avoid refetch loops.
export function DocumentGrid({ fetchPage, deps = [] }) {
  const [stack, setStack] = useState([]);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const currentFolderId = stack.length ? stack[stack.length - 1].id : undefined;

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError('');
    setMessage('');
    fetchPage(currentFolderId)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        if (result.message) setMessage(result.message);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Documents could not be loaded.'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId, ...deps]);

  const openFolder = (item) => setStack((prev) => [...prev, { id: item.id, name: item.name }]);
  const goToCrumb = (index) => setStack((prev) => prev.slice(0, index + 1));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, marginBottom: 14 }}>
        <button type="button" className="text-action" onClick={() => setStack([])}>Documents</button>
        {stack.map((crumb, i) => <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span>/</span><button type="button" className="text-action" onClick={() => goToCrumb(i)}>{crumb.name}</button></span>)}
      </div>
      {error && <div className="acc-warning" style={{ marginBottom: 14 }}>{error}</div>}
      {items === null && !error ? (
        <div className="school-loading"><span className="acc-spinner" /> Loading documents…</div>
      ) : message ? (
        <div className="school-empty"><strong>No documents folder linked yet</strong><span>{message}</span></div>
      ) : items.length === 0 ? (
        <div className="school-empty"><strong>This folder is empty</strong><span>Nothing has been uploaded here yet.</span></div>
      ) : (
        <div className="document-card-grid">
          {items.map((item) => {
            const Tag = item.isFolder ? 'button' : 'a';
            const tagProps = item.isFolder
              ? { type: 'button', onClick: () => openFolder(item) }
              : { href: item.viewUrl, target: '_blank', rel: 'noreferrer' };
            return (
              <Tag key={item.id} className="document-card" {...tagProps}>
                <div className="document-card-preview"><DocumentThumbnail item={item} /></div>
                <div className="document-card-name">{item.name}</div>
                <div className="document-card-meta">Modified {timeAgo(item.modifiedTimeMs) || item.modifiedTime || 'recently'}{item.modifiedBy ? ` by ${item.modifiedBy}` : ''}</div>
              </Tag>
            );
          })}
        </div>
      )}
    </>
  );
}
