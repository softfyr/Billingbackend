/**
 * Centralized Party (Customer / Supplier) Utility Engine
 * Provides shared ledger balance computation, running balance calculation, and party data sanitization.
 */

import { normalizeMobileNumber } from './mobile.utility.js';
import { ApiError } from './apiError.js';

/**
 * Normalizes party contact input data (Mobile, GSTIN, PAN, Name).
 */
export const sanitizePartyInput = (data = {}) => {
  const name = data.name !== undefined ? data.name : (data.customerName !== undefined ? data.customerName : data.supplierName);
  const rawMobile = data.mobileNumber || data.mobile || data.phone;

  const cleanName = name !== undefined && name !== null ? String(name).trim() : (name === null ? null : undefined);
  const cleanMobile = rawMobile ? normalizeMobileNumber(rawMobile) : undefined;
  const cleanEmail = data.email !== undefined && data.email !== null ? String(data.email).trim() : (data.email === null ? null : undefined);
  const cleanGstin = data.gstin !== undefined && data.gstin !== null ? String(data.gstin).trim().toUpperCase() : (data.gstin === null ? null : undefined);
  const panInput = data.pan !== undefined ? data.pan : data.panNumber;
  const cleanPan = panInput !== undefined && panInput !== null ? String(panInput).trim().toUpperCase() : (panInput === null ? null : undefined);

  return {
    name: cleanName,
    mobileNumber: cleanMobile,
    email: cleanEmail,
    gstin: cleanGstin,
    pan: cleanPan
  };
};

/**
 * Calculates running balance for Customer/Supplier ledger statements.
 * Sorts transactions chronologically by date.
 * 
 * @param {Array<{id: string, date: Date|string, type: string, referenceNumber: string, credit: number, debit: number, notes: string}>} transactions
 * @returns {{totalCredit: number, totalDebit: number, closingBalance: number, ledgerEntries: Array<object>}}
 */
export const calculatePartyLedgerRunningBalance = (transactions = []) => {
  if (!Array.isArray(transactions)) return { totalCredit: 0, totalDebit: 0, closingBalance: 0, ledgerEntries: [] };

  // Sort transactions chronologically by date ascending
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = 0;
  let totalCredit = 0;
  let totalDebit = 0;

  const ledgerEntries = sorted.map(entry => {
    const credit = Math.round((parseFloat(entry.credit) || 0) * 100) / 100;
    const debit = Math.round((parseFloat(entry.debit) || 0) * 100) / 100;

    totalCredit += credit;
    totalDebit += debit;
    runningBalance += (credit - debit);

    return {
      ...entry,
      credit,
      debit,
      runningBalance: Math.round(runningBalance * 100) / 100
    };
  });

  return {
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    closingBalance: Math.round(runningBalance * 100) / 100,
    ledgerEntries
  };
};
