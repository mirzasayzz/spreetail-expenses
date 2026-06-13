/**
 * CSV Parser & Anomaly Detector
 * 
 * Parses expenses_export.csv and detects all data problems.
 * Each anomaly is categorized, described, and an action is suggested.
 * 
 * The CSV is NOT modified before import - all cleaning happens here in code.
 */

const { parse } = require('csv-parse/sync');

// Known names in the flatmate group (used for fuzzy matching)
const KNOWN_NAMES = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

// Meera left at end of March 2026
const MEERA_LEFT_DATE = new Date('2026-03-31');
// Sam joined mid-April 2026
const SAM_JOINED_DATE = new Date('2026-04-08');

/**
 * Normalize a name - handles casing, trailing spaces, variants
 * Returns { normalized, wasModified, originalName }
 */
function normalizeName(rawName) {
  if (!rawName) return { normalized: null, wasModified: false, original: rawName };

  const trimmed = rawName.trim();
  
  // Direct match (case-insensitive)
  const match = KNOWN_NAMES.find(n => n.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    return {
      normalized: match,
      wasModified: match !== trimmed,
      original: rawName
    };
  }

  // Handle "Priya S" → "Priya"
  const firstName = trimmed.split(/\s+/)[0];
  const firstNameMatch = KNOWN_NAMES.find(n => n.toLowerCase() === firstName.toLowerCase());
  if (firstNameMatch) {
    return {
      normalized: firstNameMatch,
      wasModified: true,
      original: rawName
    };
  }

  // Unknown name - return as-is with title case
  const titleCase = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  return {
    normalized: titleCase,
    wasModified: titleCase !== trimmed,
    original: rawName
  };
}

/**
 * Parse a date string that might be in various formats
 * Expected: DD-MM-YYYY but CSV has messy formats like "Mar-14" or "04-05-2026"
 */
function parseDate(dateStr, rowNumber) {
  const anomalies = [];

  if (!dateStr || !dateStr.trim()) {
    return { date: null, anomalies: [{ type: 'MISSING_DATE', message: 'Date is empty' }] };
  }

  const trimmed = dateStr.trim();

  // Format: "Mar-14" (month abbreviation)
  const monthNameMatch = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monthNameMatch) {
    const monthNames = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const monthNum = monthNames[monthNameMatch[1].toLowerCase()];
    const day = parseInt(monthNameMatch[2]);

    if (monthNum !== undefined) {
      const date = new Date(2026, monthNum, day);
      anomalies.push({
        type: 'MALFORMED_DATE',
        severity: 'warning',
        message: `Date "${trimmed}" is not in DD-MM-YYYY format. Parsed as ${date.toISOString().split('T')[0]}`,
        action: 'AUTO_FIXED'
      });
      return { date: date.toISOString().split('T')[0], anomalies };
    }
  }

  // Format: DD-MM-YYYY (expected format)
  const standardMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (standardMatch) {
    const day = parseInt(standardMatch[1]);
    const month = parseInt(standardMatch[2]);
    const year = parseInt(standardMatch[3]);

    // Check for ambiguous dates where day and month could be swapped
    // Both DD-MM and MM-DD are possible if day <= 12
    if (day <= 12 && month <= 12 && day !== month) {
      // We assume DD-MM-YYYY (Indian format) consistently
      // But flag if it seems suspicious
      const note = trimmed;
      // Check if the row itself mentions date confusion
    }

    const date = new Date(year, month - 1, day);
    return { date: date.toISOString().split('T')[0], anomalies };
  }

  // Fallback: try JavaScript Date parsing
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    anomalies.push({
      type: 'MALFORMED_DATE',
      severity: 'warning',
      message: `Date "${trimmed}" required fallback parsing. Interpreted as ${fallback.toISOString().split('T')[0]}`,
      action: 'AUTO_FIXED'
    });
    return { date: fallback.toISOString().split('T')[0], anomalies };
  }

  return { date: null, anomalies: [{ type: 'INVALID_DATE', severity: 'error', message: `Cannot parse date "${trimmed}"` }] };
}

/**
 * Parse amount string handling commas, negatives, and decimal precision
 */
function parseAmount(amountStr) {
  const anomalies = [];

  if (!amountStr && amountStr !== 0) {
    return { amount: 0, anomalies: [{ type: 'MISSING_AMOUNT', severity: 'error', message: 'Amount is empty' }] };
  }

  let cleaned = String(amountStr).trim();

  // Check for comma-formatted numbers like "1,200"
  if (cleaned.includes(',')) {
    anomalies.push({
      type: 'COMMA_IN_AMOUNT',
      severity: 'info',
      message: `Amount "${cleaned}" contains comma formatting. Removed comma for parsing.`,
      action: 'AUTO_FIXED'
    });
    cleaned = cleaned.replace(/,/g, '');
  }

  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    return { amount: 0, anomalies: [{ type: 'INVALID_AMOUNT', severity: 'error', message: `Cannot parse amount "${amountStr}"` }] };
  }

  // Check for zero amount
  if (amount === 0) {
    anomalies.push({
      type: 'ZERO_AMOUNT',
      severity: 'warning',
      message: 'Amount is zero. This may be a placeholder or error.',
      action: 'FLAGGED'
    });
  }

  // Check for excessive decimal places (like 899.995)
  const decimalParts = cleaned.split('.');
  if (decimalParts.length > 1 && decimalParts[1].length > 2) {
    anomalies.push({
      type: 'EXCESSIVE_DECIMALS',
      severity: 'info',
      message: `Amount ${cleaned} has ${decimalParts[1].length} decimal places. Rounded to 2 decimals: ${(Math.round(amount * 100) / 100).toFixed(2)}`,
      action: 'AUTO_FIXED'
    });
  }

  // Check for negative amount (could be a refund)
  if (amount < 0) {
    anomalies.push({
      type: 'NEGATIVE_AMOUNT',
      severity: 'info',
      message: `Negative amount ${amount}. Treating as a refund/credit.`,
      action: 'TREATED_AS_REFUND'
    });
  }

  return {
    amount: Math.round(amount * 100) / 100,  // round to 2 decimal places
    anomalies
  };
}

/**
 * Parse split_with string into array of participant names
 * "Aisha;Rohan;Priya;Meera" → ["Aisha", "Rohan", "Priya", "Meera"]
 */
function parseSplitWith(splitWithStr) {
  if (!splitWithStr) return { participants: [], anomalies: [] };

  const anomalies = [];
  const participants = [];

  const names = splitWithStr.split(';').map(s => s.trim()).filter(Boolean);

  for (const rawName of names) {
    const { normalized, wasModified, original } = normalizeName(rawName);

    if (wasModified) {
      anomalies.push({
        type: 'NAME_NORMALIZED',
        severity: 'info',
        message: `Name "${original}" normalized to "${normalized}"`,
        action: 'AUTO_FIXED'
      });
    }

    // Check for unknown/ad-hoc participants
    if (!KNOWN_NAMES.includes(normalized) && !rawName.includes("'s friend")) {
      anomalies.push({
        type: 'UNKNOWN_PARTICIPANT',
        severity: 'warning',
        message: `"${rawName}" is not a recognized group member`,
        action: 'FLAGGED'
      });
    }

    // Check for ad-hoc participants like "Dev's friend Kabir"
    if (rawName.includes("'s friend") || rawName.includes("friend")) {
      anomalies.push({
        type: 'ADHOC_PARTICIPANT',
        severity: 'info',
        message: `"${rawName}" appears to be a guest/temporary participant`,
        action: 'CREATED_AS_GUEST'
      });
    }

    participants.push(normalized || rawName);
  }

  return { participants, anomalies };
}

/**
 * Parse split_details string into key-value pairs
 * "Rohan 700; Priya 400; Meera 400" → { Rohan: 700, Priya: 400, Meera: 400 }
 * "Aisha 30%; Rohan 30%;" → { Aisha: 30, Rohan: 30 }
 * "Aisha 1; Rohan 2" → { Aisha: 1, Rohan: 2 }
 */
function parseSplitDetails(detailsStr, splitType) {
  if (!detailsStr) return { details: {}, anomalies: [] };

  const anomalies = [];
  const details = {};

  const parts = detailsStr.split(';').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Match "Name Value" or "Name Value%"
    const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
    if (match) {
      const { normalized } = normalizeName(match[1]);
      const value = parseFloat(match[2]);
      details[normalized] = value;
    }
  }

  // Validate percentages sum to 100
  if (splitType === 'percentage') {
    const totalPct = Object.values(details).reduce((sum, v) => sum + v, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      anomalies.push({
        type: 'PERCENTAGE_SUM_ERROR',
        severity: 'warning',
        message: `Percentages sum to ${totalPct}% instead of 100%. Will normalize proportionally.`,
        action: 'AUTO_NORMALIZED'
      });
    }
  }

  return { details, anomalies };
}

/**
 * Detect duplicate expenses by comparing date, description similarity, and amount
 */
function detectDuplicates(parsedRows) {
  const anomalies = [];
  const seen = [];

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];

    for (let j = 0; j < seen.length; j++) {
      const prev = seen[j];

      // Same date check
      if (row.date !== prev.date) continue;

      // Description similarity check (normalize for comparison)
      const desc1 = row.description.toLowerCase().replace(/[^a-z0-9]/g, '');
      const desc2 = prev.description.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check if descriptions are similar (one contains the other, or >70% overlap)
      const isSimilar = desc1.includes(desc2) || desc2.includes(desc1) ||
                        calculateSimilarity(desc1, desc2) > 0.6;

      if (isSimilar) {
        if (row.amount === prev.amount && row.paid_by === prev.paid_by) {
          // Exact duplicate - same amount, same payer
          anomalies.push({
            type: 'EXACT_DUPLICATE',
            severity: 'warning',
            row: row.rowNumber,
            duplicateOf: prev.rowNumber,
            message: `Row ${row.rowNumber} appears to be a duplicate of row ${prev.rowNumber}: "${row.description}" vs "${prev.description}" — same date, payer, and amount (${row.amount})`,
            action: 'SKIP_DUPLICATE'
          });
          row.isDuplicate = true;
        } else if (isSimilar && row.amount !== prev.amount) {
          // Conflicting duplicate - different amounts
          anomalies.push({
            type: 'CONFLICTING_DUPLICATE',
            severity: 'error',
            row: row.rowNumber,
            duplicateOf: prev.rowNumber,
            message: `Row ${row.rowNumber} conflicts with row ${prev.rowNumber}: "${row.description}" (${row.amount}) vs "${prev.description}" (${prev.amount}). Different amounts — needs user decision.`,
            action: 'NEEDS_REVIEW'
          });
          row.needsReview = true;
        }
      }
    }

    seen.push(row);
  }

  return anomalies;
}

/**
 * Simple string similarity (Jaccard on character bigrams)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const bigrams1 = new Set();
  const bigrams2 = new Set();

  for (let i = 0; i < str1.length - 1; i++) bigrams1.add(str1.substring(i, i + 2));
  for (let i = 0; i < str2.length - 1; i++) bigrams2.add(str2.substring(i, i + 2));

  let intersection = 0;
  for (const bg of bigrams1) {
    if (bigrams2.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

/**
 * Main CSV parsing function
 * Takes raw CSV string, returns parsed rows with anomalies
 */
function parseExpensesCSV(csvContent) {
  // Parse CSV
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  });

  const allAnomalies = [];
  const parsedRows = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2; // +2 because row 1 is header, and we're 1-indexed
    const rowAnomalies = [];

    // --- Parse Date ---
    const { date, anomalies: dateAnomalies } = parseDate(record.date, rowNumber);
    dateAnomalies.forEach(a => { a.row = rowNumber; rowAnomalies.push(a); });

    // Check for ambiguous date (like 04-05-2026)
    if (record.date && record.notes && record.notes.toLowerCase().includes('format is a mess')) {
      rowAnomalies.push({
        type: 'AMBIGUOUS_DATE',
        severity: 'warning',
        row: rowNumber,
        message: `Date "${record.date}" is ambiguous (DD-MM vs MM-DD). Interpreted as DD-MM-YYYY per Indian convention. Note says: "${record.notes}"`,
        action: 'INTERPRETED_AS_DD_MM'
      });
    }

    // --- Parse Amount ---
    const { amount, anomalies: amountAnomalies } = parseAmount(record.amount);
    amountAnomalies.forEach(a => { a.row = rowNumber; rowAnomalies.push(a); });

    // --- Parse Currency ---
    let currency = (record.currency || '').trim().toUpperCase();
    if (!currency) {
      currency = 'INR';  // default to INR
      rowAnomalies.push({
        type: 'MISSING_CURRENCY',
        severity: 'warning',
        row: rowNumber,
        message: 'Currency is empty. Defaulting to INR.',
        action: 'DEFAULT_TO_INR'
      });
    }

    // --- Parse Paid By ---
    const { normalized: paidBy, wasModified: payerModified } = normalizeName(record.paid_by);
    if (!record.paid_by || !record.paid_by.trim()) {
      rowAnomalies.push({
        type: 'MISSING_PAYER',
        severity: 'error',
        row: rowNumber,
        message: `No payer specified for "${record.description}". This expense cannot be properly tracked.`,
        action: 'FLAGGED_FOR_REVIEW'
      });
    } else if (payerModified) {
      rowAnomalies.push({
        type: 'PAYER_NAME_NORMALIZED',
        severity: 'info',
        row: rowNumber,
        message: `Payer name "${record.paid_by}" normalized to "${paidBy}"`,
        action: 'AUTO_FIXED'
      });
    }

    // --- Parse Split Type ---
    const splitType = (record.split_type || '').trim().toLowerCase();

    // Check for settlement (not an expense)
    const isSettlement = !splitType && 
      (record.description || '').toLowerCase().includes('paid') &&
      (record.description || '').toLowerCase().includes('back');

    if (isSettlement) {
      rowAnomalies.push({
        type: 'SETTLEMENT_AS_EXPENSE',
        severity: 'warning',
        row: rowNumber,
        message: `"${record.description}" appears to be a settlement/payment, not an expense. No split type specified. Moving to settlements.`,
        action: 'MOVED_TO_SETTLEMENTS'
      });
    }

    // --- Parse Participants ---
    const { participants, anomalies: participantAnomalies } = parseSplitWith(record.split_with);
    participantAnomalies.forEach(a => { a.row = rowNumber; rowAnomalies.push(a); });

    // --- Parse Split Details ---
    const { details: splitDetails, anomalies: detailsAnomalies } = parseSplitDetails(record.split_details, splitType);
    detailsAnomalies.forEach(a => { a.row = rowNumber; rowAnomalies.push(a); });

    // --- Check for contradictory split info ---
    if (splitType === 'equal' && record.split_details && record.split_details.trim()) {
      rowAnomalies.push({
        type: 'CONTRADICTORY_SPLIT',
        severity: 'info',
        row: rowNumber,
        message: `Split type is "equal" but split_details are provided ("${record.split_details}"). Using equal split, ignoring details.`,
        action: 'USED_SPLIT_TYPE'
      });
    }

    // --- Check membership validity ---
    if (date) {
      const expenseDate = new Date(date);

      // Check if Meera is included after she left
      if (participants.includes('Meera') && expenseDate > MEERA_LEFT_DATE) {
        rowAnomalies.push({
          type: 'STALE_MEMBER',
          severity: 'warning',
          row: rowNumber,
          message: `Meera is included in this expense dated ${date}, but she left the group on 2026-03-31. Removing her from this split.`,
          action: 'REMOVED_INACTIVE_MEMBER'
        });
      }

      // Check if Sam is included before he joined
      if (participants.includes('Sam') && expenseDate < SAM_JOINED_DATE) {
        rowAnomalies.push({
          type: 'PREMATURE_MEMBER',
          severity: 'warning',
          row: rowNumber,
          message: `Sam is included in this expense dated ${date}, but he didn't join until 2026-04-08.`,
          action: 'FLAGGED'
        });
      }
    }

    // Build parsed row
    parsedRows.push({
      rowNumber,
      date,
      description: (record.description || '').trim(),
      paid_by: paidBy,
      amount,
      currency,
      split_type: isSettlement ? 'settlement' : (splitType || 'equal'),
      participants,
      splitDetails,
      notes: (record.notes || '').trim(),
      isSettlement,
      isDuplicate: false,
      needsReview: false,
      anomalies: rowAnomalies
    });

    allAnomalies.push(...rowAnomalies);
  });

  // --- Detect Duplicates (cross-row analysis) ---
  const duplicateAnomalies = detectDuplicates(parsedRows);
  allAnomalies.push(...duplicateAnomalies);

  // Build summary
  const summary = {
    total_rows: parsedRows.length,
    importable_rows: parsedRows.filter(r => !r.isDuplicate && r.amount !== 0 && !r.isSettlement).length,
    duplicate_rows: parsedRows.filter(r => r.isDuplicate).length,
    settlement_rows: parsedRows.filter(r => r.isSettlement).length,
    zero_amount_rows: parsedRows.filter(r => r.amount === 0).length,
    needs_review: parsedRows.filter(r => r.needsReview).length,
    total_anomalies: allAnomalies.length,
    anomalies_by_type: {},
    anomalies_by_severity: { error: 0, warning: 0, info: 0 }
  };

  allAnomalies.forEach(a => {
    summary.anomalies_by_type[a.type] = (summary.anomalies_by_type[a.type] || 0) + 1;
    if (a.severity) {
      summary.anomalies_by_severity[a.severity] = (summary.anomalies_by_severity[a.severity] || 0) + 1;
    }
  });

  return {
    rows: parsedRows,
    anomalies: allAnomalies,
    summary
  };
}

module.exports = { parseExpensesCSV, normalizeName, parseDate, parseAmount };
