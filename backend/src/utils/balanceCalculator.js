const { query } = require('../db');

/**
 * Balance Calculator
 * 
 * Calculates net balances for all members in a group.
 * 
 * Logic:
 *   For each expense:
 *     - The payer gets credit for the full amount
 *     - Each participant (including payer) is debited their split share
 *   
 *   Net balance = total_paid - total_owed
 *     Positive = others owe you money
 *     Negative = you owe others money
 * 
 * For multi-currency:
 *   All amounts are converted to INR using a fixed exchange rate.
 *   This rate is documented in DECISIONS.md.
 */

const USD_TO_INR = parseFloat(process.env.USD_TO_INR) || 83.0;

/**
 * Convert an amount to INR based on currency
 */
function toINR(amount, currency) {
  if (currency === 'USD') {
    return Math.round(amount * USD_TO_INR * 100) / 100;
  }
  return parseFloat(amount);
}

/**
 * Calculate net balances for all members in a group
 * Returns an array of { user_id, user_name, total_paid, total_owed, net_balance }
 */
async function calculateGroupBalances(groupId) {
  // Get all expenses with their splits (excluding settlements)
  const expensesResult = await query(
    `SELECT e.id, e.amount, e.currency, e.paid_by, e.description, e.date,
            es.user_id AS split_user_id, es.amount_owed
     FROM expenses e
     JOIN expense_splits es ON e.id = es.expense_id
     WHERE e.group_id = $1 AND e.is_settlement = FALSE
     ORDER BY e.date`,
    [groupId]
  );

  // Get all settlements
  const settlementsResult = await query(
    'SELECT from_user, to_user, amount, currency FROM settlements WHERE group_id = $1',
    [groupId]
  );

  // Get all members
  const membersResult = await query(
    `SELECT u.id, u.name FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     WHERE gm.group_id = $1`,
    [groupId]
  );

  // Build balance map: userId -> { total_paid (INR), total_owed (INR) }
  const balances = {};
  membersResult.rows.forEach(member => {
    balances[member.id] = {
      user_id: member.id,
      user_name: member.name,
      total_paid: 0,
      total_owed: 0,
      expenses_paid: [],    // for Rohan's request - detailed breakdown
      expenses_owed: []
    };
  });

  // Process each expense split
  const processedExpenses = new Set();
  for (const row of expensesResult.rows) {
    const amountINR = toINR(row.amount, row.currency);
    const splitINR = toINR(row.amount_owed, row.currency);

    // Credit the payer (only once per expense)
    if (row.paid_by && balances[row.paid_by] && !processedExpenses.has(row.id)) {
      balances[row.paid_by].total_paid += amountINR;
      balances[row.paid_by].expenses_paid.push({
        expense_id: row.id,
        description: row.description,
        amount: amountINR,
        date: row.date
      });
      processedExpenses.add(row.id);
    }

    // Debit each participant their share
    if (balances[row.split_user_id]) {
      balances[row.split_user_id].total_owed += splitINR;
      balances[row.split_user_id].expenses_owed.push({
        expense_id: row.id,
        description: row.description,
        amount: splitINR,
        date: row.date
      });
    }
  }

  // Apply settlements
  for (const settlement of settlementsResult.rows) {
    const amountINR = toINR(settlement.amount, settlement.currency);

    if (balances[settlement.from_user]) {
      balances[settlement.from_user].total_paid += amountINR;
    }
    if (balances[settlement.to_user]) {
      balances[settlement.to_user].total_owed += amountINR;
    }
  }

  // Calculate net balance for each person
  const result = Object.values(balances).map(b => ({
    ...b,
    total_paid: Math.round(b.total_paid * 100) / 100,
    total_owed: Math.round(b.total_owed * 100) / 100,
    net_balance: Math.round((b.total_paid - b.total_owed) * 100) / 100
  }));

  return result;
}

/**
 * Calculate simplified settlement suggestions
 * Uses a greedy approach: match biggest creditor with biggest debtor
 * 
 * This is what Aisha wants - "one number per person, who pays whom"
 */
async function calculateSettlements(groupId) {
  const balances = await calculateGroupBalances(groupId);

  // Separate into creditors (positive balance) and debtors (negative balance)
  const creditors = balances
    .filter(b => b.net_balance > 0.01)  // small threshold to avoid tiny amounts
    .map(b => ({ ...b, remaining: b.net_balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = balances
    .filter(b => b.net_balance < -0.01)
    .map(b => ({ ...b, remaining: Math.abs(b.net_balance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const settlements = [];

  // Greedy matching
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);

    if (amount > 0.01) {
      settlements.push({
        from: { id: debtors[i].user_id, name: debtors[i].user_name },
        to: { id: creditors[j].user_id, name: creditors[j].user_name },
        amount: Math.round(amount * 100) / 100,
        currency: 'INR'
      });
    }

    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;

    if (debtors[i].remaining < 0.01) i++;
    if (creditors[j].remaining < 0.01) j++;
  }

  return settlements;
}

module.exports = { calculateGroupBalances, calculateSettlements, toINR };
