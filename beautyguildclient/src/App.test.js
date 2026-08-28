import { ACCREDITATION_GRAND_TOTAL, ACCREDITATION_WITH_MEMBERSHIP, formatUkDate, initialAccState, isStepValid } from './accreditation/data';

test('requires a positive tutor count when other tutors are used', () => {
  const application = initialAccState();
  application.ot = 'yes';
  application.tutQual = 'yes';
  application.ov = 'no';

  expect(isStepValid(8, application)).toBe(false);

  application.otN = '2';
  expect(isStepValid(8, application)).toBe(true);
});

test('does not require a tutor count when no other tutors are used', () => {
  const application = initialAccState();
  application.ot = 'no';
  application.ov = 'no';

  expect(isStepValid(8, application)).toBe(true);
});

test('uses the agreed accreditation totals', () => {
  expect(ACCREDITATION_GRAND_TOTAL).toBe(354);
  expect(ACCREDITATION_WITH_MEMBERSHIP).toBe(409);
});

test('formats CRM ISO dates in UK numeric order', () => {
  expect(formatUkDate('2027-08-13')).toBe('13/08/2027');
  expect(formatUkDate('13/08/2027')).toBe('13/08/2027');
});
