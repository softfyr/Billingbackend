/**
 * Centralized Tax, GST & Line Item Calculation Engine
 */

export const indianStatesMap = {
  'MAHARASHTRA': '27',
  'DELHI': '07',
  'KARNATAKA': '29',
  'TAMIL NADU': '33',
  'UTTAR PRADESH': '09',
  'WEST BENGAL': '19',
  'GUJARAT': '24',
  'RAJASTHAN': '08',
  'MADHYA PRADESH': '23',
  'TELANGANA': '36',
  'ANDHRA PRADESH': '37',
  'PUNJAB': '03',
  'HARYANA': '06',
  'BIHAR': '10',
  'ODISHA': '21',
  'ASSAM': '18',
  'HIMACHAL PRADESH': '02',
  'UTTARAKHAND': '05',
  'CHHATTISGARH': '22',
  'JHARKHAND': '20',
  'GOA': '30'
};

/**
 * Calculates line item subtotal, taxable amount, tax amount, and line total.
 * Handles both GST Inclusive and Exclusive pricing models.
 */
export const calculateLineItemTaxAndTotal = ({
  unitPrice,
  quantity,
  discountAmount = 0,
  taxPercent = 0,
  taxType = 'EXCLUSIVE',
  taxMode = ''
}) => {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const disc = parseFloat(discountAmount) || 0;
  const taxPct = parseFloat(taxPercent) || 0;

  const lineSubtotal = Math.round((qty * price) * 100) / 100;
  const rawLineNet = Math.max(0, lineSubtotal - disc);

  const normalizedTaxType = String(taxType || '').toUpperCase();
  const normalizedTaxMode = String(taxMode || '').toUpperCase();
  const isInclusive = ['INCLUSIVE', 'GST_INCLUSIVE'].includes(normalizedTaxType) || ['INCLUSIVE', 'GST_INCLUSIVE'].includes(normalizedTaxMode);

  let lineTaxable = 0;
  let taxAmount = 0;
  let lineTotal = 0;

  if (isInclusive && taxPct > 0) {
    lineTaxable = Math.round((rawLineNet / (1 + (taxPct / 100))) * 100) / 100;
    taxAmount = Math.round((rawLineNet - lineTaxable) * 100) / 100;
    lineTotal = rawLineNet;
  } else {
    lineTaxable = Math.round(rawLineNet * 100) / 100;
    taxAmount = Math.round(((lineTaxable * taxPct) / 100) * 100) / 100;
    lineTotal = Math.round((lineTaxable + taxAmount) * 100) / 100;
  }

  return {
    lineSubtotal,
    discountAmount: disc,
    rawLineNet,
    lineTaxable,
    taxPercent: taxPct,
    taxAmount,
    lineTotal
  };
};

/**
 * Resolves Inter-State vs Intra-State GST tax splits (CGST, SGST, IGST).
 */
export const resolveGstSplit = ({
  totalTaxAmount = 0,
  igstAmountInput = 0,
  targetStateCode,
  targetGstin,
  tenantState = 'MAHARASHTRA',
  tenantGstNumber
}) => {
  const taxAmt = Math.round((parseFloat(totalTaxAmount) || 0) * 100) / 100;

  const tenantStateUpper = (tenantState || 'MAHARASHTRA').toUpperCase().trim();
  const tenantStateCode = tenantGstNumber && tenantGstNumber.length >= 2
    ? tenantGstNumber.slice(0, 2)
    : (indianStatesMap[tenantStateUpper] || '27');

  const cleanGstin = (targetGstin || '').trim().toUpperCase();
  const resolvedTargetStateCode = (targetStateCode || (cleanGstin.length >= 2 ? cleanGstin.slice(0, 2) : '')).trim();

  let isInterState = false;
  if ((parseFloat(igstAmountInput) || 0) > 0) {
    isInterState = true;
  } else if (resolvedTargetStateCode && resolvedTargetStateCode !== tenantStateCode) {
    isInterState = true;
  }

  if (isInterState) {
    return {
      isInterState: true,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: taxAmt
    };
  }

  const cgst = Math.round((taxAmt / 2) * 100) / 100;
  const sgst = Math.round((taxAmt - cgst) * 100) / 100;

  return {
    isInterState: false,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: 0
  };
};

/**
 * Calculates document level totals (subtotal, discount, tax, roundOff, grandTotal).
 */
export const calculateDocumentTotals = ({
  subtotal = 0,
  totalTaxAmount = 0,
  discountType = 'NONE',
  discountValue = 0,
  roundOff = 0,
  otherCharges = 0
}) => {
  const sub = Math.round((parseFloat(subtotal) || 0) * 100) / 100;
  const tax = Math.round((parseFloat(totalTaxAmount) || 0) * 100) / 100;
  const dVal = parseFloat(discountValue) || 0;
  const rOff = parseFloat(roundOff) || 0;
  const addCharges = parseFloat(otherCharges) || 0;

  let discountAmount = 0;
  if (discountType === 'PERCENTAGE') {
    discountAmount = Math.round(((sub * dVal) / 100) * 100) / 100;
  } else if (discountType === 'FIXED') {
    discountAmount = Math.round(dVal * 100) / 100;
  }

  const rawGrandTotal = sub + tax - discountAmount + addCharges + rOff;
  const grandTotal = Math.max(0, Math.round(rawGrandTotal * 100) / 100);

  return {
    subtotal: sub,
    totalTaxAmount: tax,
    discountAmount,
    otherCharges: addCharges,
    roundOff: rOff,
    grandTotal
  };
};
