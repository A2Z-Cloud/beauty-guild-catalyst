export const RULE_STATUS = {
  PASS: 'PASS',
  REFER: 'REFER',
  STOP: 'STOP',
};

function result(status, code, customerMessage, internalReason) {
  return { status, code, customerMessage, internalReason: internalReason || customerMessage };
}

function positive(value) {
  return Math.max(0, Number(value || 0));
}

export function evaluateInsuranceRules(state) {
  const results = [];

  if (state.territory === 'other') {
    results.push(result(RULE_STATUS.STOP, 'UNSUPPORTED_TERRITORY', 'We cannot complete an online quotation for this territory.', 'Customer outside supported territory.'));
  }

  if (positive(state.employees) + positive(state.subcontractors) > 4) {
    results.push(result(RULE_STATUS.REFER, 'NAMED_PEOPLE_LIMIT', 'The Insurance team needs to review the number of people working in your business.', 'More than four named employees/subcontractors.'));
  }

  if (state.route === 'salon') {
    if (positive(state.turnover) > 250000) {
      results.push(result(RULE_STATUS.STOP, 'SALON_TURNOVER_LIMIT', 'Your annual turnover is above the current online quotation limit.'));
    }
    if (positive(state.wageRoll) > 125000) {
      results.push(result(RULE_STATUS.STOP, 'WAGE_ROLL_LIMIT', 'Your annual wage roll is above the current online quotation limit.'));
    }
    if (positive(state.salonCount) > 1) {
      results.push(result(RULE_STATUS.REFER, 'MULTIPLE_SALONS', 'More than one salon needs to be reviewed by the Insurance team.'));
    }

    if (state.contents) {
      const totalContents = ['computers','equipment','stock','generalContents','tenantImprovements','rentPayable']
        .reduce((sum, key) => sum + positive(state[key]), 0);
      if (totalContents > 250000) results.push(result(RULE_STATUS.STOP, 'CONTENTS_LIMIT', 'Your Contents sum insured is above £250,000.'));
    }

    if (state.buildingsCover) {
      const buildingsTotal = positive(state.buildingsSI) + positive(state.fixturesSI) + positive(state.rentReceivableSI);
      if (buildingsTotal > 500000) results.push(result(RULE_STATUS.STOP, 'BUILDINGS_LIMIT', 'Your Buildings sum insured is above £500,000.'));
    }

    if (state.biCover) {
      const biTotal = positive(state.biIncome) + positive(state.biDebts);
      if (biTotal > 300000) results.push(result(RULE_STATUS.STOP, 'BI_LIMIT', 'Your Business Interruption sum insured is above £300,000.'));
    }

    if (state.propertyAwayCover && positive(state.propertyAwaySI) > 25000) {
      results.push(result(RULE_STATUS.STOP, 'PROPERTY_AWAY_LIMIT', 'Your Property Away sum insured is above £25,000.'));
    }

    if (state.floodHistory === 'yes' && state.basement === 'yes') {
      results.push(result(RULE_STATUS.REFER, 'FLOOD_BASEMENT', 'The Insurance team needs to review the flood history for this premises.'));
    }

    if (state.subsidenceHistory === 'yes') {
      results.push(result(RULE_STATUS.REFER, 'SUBSIDENCE_HISTORY', 'The Insurance team needs to review the subsidence history for this premises.'));
    }
  } else if (Number(state.equipmentTier) > 0) {
    if (state.standardConstruction === 'no' && state.nonStandardOver15 === 'yes') {
      results.push(result(RULE_STATUS.REFER, 'NON_STANDARD_CONSTRUCTION', 'The construction of the premises needs to be reviewed by the Insurance team.'));
    }
    if (state.multipleAddresses === 'yes') {
      results.push(result(RULE_STATUS.REFER, 'MULTIPLE_ADDRESSES', 'Cover across multiple addresses needs to be reviewed by the Insurance team.'));
    }
  }

  if ((state.treatmentExtensions || []).length) {
    if (state.qualifiedForTreatments === 'no') {
      results.push(result(RULE_STATUS.STOP, 'TREATMENT_QUALIFICATION', 'The required treatment qualifications must be confirmed before continuing.'));
    }
    if (state.patchTesting === 'no') {
      results.push(result(RULE_STATUS.STOP, 'PATCH_TESTING', 'The required patch testing declaration must be confirmed before continuing.'));
    }
  }

  if (state.informationAccurate === 'no') {
    results.push(result(RULE_STATUS.STOP, 'INFORMATION_ACCURACY', 'The information provided must be confirmed as complete and accurate before continuing.'));
  }
  if (state.ethicsAccepted === 'no') {
    results.push(result(RULE_STATUS.STOP, 'CODE_OF_ETHICS', 'The Beauty Guild Code of Ethics must be accepted before continuing.'));
  }
  if (state.demandsNeedsAccepted === 'no') {
    results.push(result(RULE_STATUS.STOP, 'DEMANDS_AND_NEEDS', 'The demands and needs confirmation must be accepted before continuing.'));
  }
  if (state.nonAdvisedAccepted === 'no') {
    results.push(result(RULE_STATUS.STOP, 'NON_ADVISED_SALE', 'The non-advised sale confirmation must be accepted before continuing.'));
  }

  const expectedDeclarationAnswers = ['no','no','no','no','no','yes','yes'];
  (state.declarations || []).forEach((answer, index) => {
    if (answer && answer !== expectedDeclarationAnswers[index]) {
      results.push(result(RULE_STATUS.REFER, `DECLARATION_${index + 1}`, 'One or more declaration answers need to be reviewed by the Insurance team.'));
    }
  });

  const stop = results.filter((item) => item.status === RULE_STATUS.STOP);
  const refer = results.filter((item) => item.status === RULE_STATUS.REFER);
  return {
    results,
    stop,
    refer,
    overall: stop.length ? RULE_STATUS.STOP : refer.length ? RULE_STATUS.REFER : RULE_STATUS.PASS,
  };
}
