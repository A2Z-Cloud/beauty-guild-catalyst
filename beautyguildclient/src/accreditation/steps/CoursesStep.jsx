import React, { useMemo, useState } from 'react';
import { CANT_FIND_COURSE_TITLE, CANT_FIND_COURSE_BODY } from '../data';

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

function CourseRequirementsModal({ course, selected, onClose, onToggle }) {
  if (!course) return null;
  const minFee = formatPrice(course.memberPrice) || formatPrice(course.nonMemberPrice);
  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal course-requirements-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-title">{course.name}</div>
        <div className="course-requirements-grid">
          <div>
            <div className="course-requirements-label">Minimum practical teaching time</div>
            <div className="course-requirements-value">{course.duration || 'Not specified'}</div>
          </div>
          <div>
            <div className="course-requirements-label">CPD hours</div>
            <div className="course-requirements-value">{course.cpdPoints != null ? course.cpdPoints : 'Not specified'}</div>
          </div>
          <div>
            <div className="course-requirements-label">Minimum course fee</div>
            <div className="course-requirements-value">{minFee || 'Not specified'}</div>
          </div>
        </div>
        <div className="course-requirements-label" style={{ marginTop: 16 }}>Pre-requisites</div>
        <div className="acc-modal-body" style={{ marginTop: 4, marginBottom: 18 }}>
          {course.entryRequirements || 'No specific pre-requisites listed for this course.'}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="acc-btn-secondary" style={{ flex: 1 }} onClick={onClose}>Close</button>
          <button type="button" className="acc-btn-primary" style={{ flex: 1 }} onClick={() => { onToggle(course.id); onClose(); }}>
            {selected ? 'Remove course' : 'Select this course'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CoursesStep({ acc, toggleCourse, courses, coursesError }) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState({});
  const [detailCourseId, setDetailCourseId] = useState(null);
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = (courses || []).filter((course) => !normalized || course.name.toLowerCase().includes(normalized));
    const grouped = groupByTreatmentGroup(filtered);
    return grouped.sort((a, b) => a.title === 'Other' ? 1 : b.title === 'Other' ? -1 : a.title.localeCompare(b.title));
  }, [courses, query]);
  const toggleGroup = (title) => setOpenGroups((prev) => ({ ...prev, [title]: prev[title] === undefined ? false : !prev[title] }));
  const allOpen = groups.length > 0 && groups.every((group) => openGroups[group.title] === true);
  const setAllGroups = (open) => setOpenGroups(Object.fromEntries(groups.map((group) => [group.title, open])));
  const detailCourse = detailCourseId != null ? (courses || []).find((c) => c.id === detailCourseId) || null : null;
  return (
    <>
      <div className="acc-course-heading">
        <div>
          <div className="acc-step-heading">Select the GTi courses you wish to teach</div>
          <div className="acc-step-sub" style={{ maxWidth: 620 }}>
            This is the complete list of GTi courses available to Guild-accredited schools. Select every course you wish to
            offer, provided you hold the appropriate qualifications and experience and can meet that course's requirements.
            Use "View course requirements" on a course to check what's needed before selecting it.
          </div>
        </div>
        <span className="acc-selection-count">
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

      {courses && <div className="acc-course-browser">{groups.map((grp) => {
        const count = grp.items.filter((c) => acc.courses.includes(c.id)).length;
        const isOpen = openGroups[grp.title] === true || (openGroups[grp.title] === undefined && (count > 0 || groups.length === 1));
        return (
          <section className="acc-card acc-course-group" key={grp.title}>
            <button type="button" className="acc-course-group-header acc-course-group-toggle" onClick={() => toggleGroup(grp.title)} aria-expanded={isOpen}>
              <div className="acc-course-group-title">{grp.title}</div>
              <span className="acc-course-group-right">{count > 0 && <span className="acc-course-group-count">{count} selected</span>}<span aria-hidden="true">{isOpen ? '−' : '+'}</span></span>
            </button>
            {isOpen && <div className="acc-course-grid">
              {grp.items.map((c) => {
                const selected = acc.courses.includes(c.id);
                const meta = [c.duration, c.cpdPoints != null ? `${c.cpdPoints} CPD hours` : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <div key={c.id} className={`acc-course-chip${selected ? ' selected' : ''}`} style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6, cursor: 'default' }}>
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer' }}
                      onClick={() => toggleCourse(c.id)}
                    >
                      <span className={`acc-checkbox${selected ? ' selected' : ''}`}>{selected ? '✓' : ''}</span>
                      <span style={{ flex: 1, fontWeight: 700 }}>{c.name}</span>
                    </span>
                    {meta && <span style={{ fontSize: 11.5, color: 'rgba(0,0,0,.62)', paddingLeft: 30 }}>{meta}</span>}
                    <button
                      type="button"
                      className="text-action"
                      style={{ marginLeft: 30, padding: 0 }}
                      onClick={() => setDetailCourseId(c.id)}
                    >
                      View course requirements →
                    </button>
                  </div>
                );
              })}
            </div>}
          </section>
        );
      })}</div>}

      <div className="acc-card cant-find-course">
        <div className="acc-card-title">{CANT_FIND_COURSE_TITLE}</div>
        <div className="acc-step-sub" style={{ marginTop: 6 }}>{CANT_FIND_COURSE_BODY}</div>
      </div>

      <CourseRequirementsModal
        course={detailCourse}
        selected={detailCourse ? acc.courses.includes(detailCourse.id) : false}
        onClose={() => setDetailCourseId(null)}
        onToggle={toggleCourse}
      />
    </>
  );
}
