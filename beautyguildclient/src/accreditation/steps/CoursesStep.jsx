import React, { useMemo, useState } from 'react';

function groupByTreatmentGroup(courses) {
  const groups = {};
  courses.forEach((c) => {
    const key = c.treatmentGroup || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return Object.entries(groups).map(([title, items]) => ({ title, items }));
}

function formatPrice(n) {
  return typeof n === 'number' ? `£${n.toFixed(2)}` : null;
}

export default function CoursesStep({ acc, toggleCourse, courses, coursesError }) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = (courses || []).filter((course) => !normalized || course.name.toLowerCase().includes(normalized));
    const grouped = groupByTreatmentGroup(filtered);
    return grouped.sort((a, b) => a.title === 'Other' ? 1 : b.title === 'Other' ? -1 : a.title.localeCompare(b.title));
  }, [courses, query]);
  const toggleGroup = (title) => setOpenGroups((prev) => ({ ...prev, [title]: prev[title] === undefined ? false : !prev[title] }));
  const allOpen = groups.length > 0 && groups.every((group) => openGroups[group.title] === true);
  const setAllGroups = (open) => setOpenGroups(Object.fromEntries(groups.map((group) => [group.title, open])));
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="acc-step-heading">Select Your Courses</div>
          <div className="acc-step-sub" style={{ maxWidth: 620 }}>
            <p style={{ margin: '0 0 10px' }}>GTi courses are available for most popular beauty, nails, hair and holistic treatments.</p>
            <p style={{ margin: '0 0 10px' }}>The theory for all GTi courses is delivered and assessed online, leaving you to concentrate all your time on teaching the practical techniques required to carry out the treatment.</p>
            <p style={{ margin: '0 0 10px' }}>You can opt to teach as many different GTi courses as you like, providing you have declared that you hold the relevant qualifications for each treatment.</p>
            <p style={{ margin: 0 }}>Tick the GTi courses you wish to offer.</p>
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E00879', background: '#FFF0F7', padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {acc.courses.length} selected
        </span>
      </div>

      {coursesError && (
        <div className="acc-warning">
          <div className="acc-warning-title">Couldn't load courses</div>
          <div className="acc-warning-body">{coursesError} — you can still continue and add courses later from your portal.</div>
        </div>
      )}

      {!coursesError && courses === null && (
        <div className="acc-step-sub">Loading courses…</div>
      )}

      {courses && <div className="acc-course-toolbar">
        <input className="acc-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses…" aria-label="Search courses" />
        <div className="acc-course-toolbar-actions">
          <button type="button" className="acc-btn-secondary" onClick={() => setAllGroups(!allOpen)}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
          <span className="acc-course-result-count">{groups.reduce((total, group) => total + group.items.length, 0)} courses</span>
        </div>
      </div>}

      {courses && groups.map((grp) => {
        const count = grp.items.filter((c) => acc.courses.includes(c.id)).length;
        const isOpen = openGroups[grp.title] === true || (openGroups[grp.title] === undefined && (count > 0 || groups.length === 1));
        return (
          <div className="acc-card" key={grp.title}>
            <button type="button" className="acc-course-group-header acc-course-group-toggle" onClick={() => toggleGroup(grp.title)} aria-expanded={isOpen}>
              <div className="acc-course-group-title">{grp.title}</div>
              <span className="acc-course-group-right">{count > 0 && <span className="acc-course-group-count">{count} selected</span>}<span aria-hidden="true">{isOpen ? '−' : '+'}</span></span>
            </button>
            {isOpen && <div className="acc-course-grid">
              {grp.items.map((c) => {
                const selected = acc.courses.includes(c.id);
                const meta = [c.duration, c.cpdPoints != null ? `${c.cpdPoints} CPD` : null, formatPrice(c.memberPrice)]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <label
                    key={c.id}
                    className={`acc-course-chip${selected ? ' selected' : ''}`}
                    onClick={() => toggleCourse(c.id)}
                    style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                      <span className={`acc-checkbox${selected ? ' selected' : ''}`}>{selected ? '✓' : ''}</span>
                      <span style={{ flex: 1 }}>{c.name}</span>
                    </span>
                    {meta && <span style={{ fontSize: 11.5, color: '#8A8598', paddingLeft: 30 }}>{meta}</span>}
                  </label>
                );
              })}
            </div>}
          </div>
        );
      })}
    </>
  );
}
