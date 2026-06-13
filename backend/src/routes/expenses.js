const express = require('express');
const { query, pool } = require('../db');
const { authenticate } = require('../middleware/auth');
const { calculateSplits } = require('../utils/splitCalculator');

const router = express.Router();

router.use(authenticate);

// POST /api/groups/:id/expenses
// Create a new expense with automatic split calculation
router.post('/:id/expenses', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: groupId } = req.params;
    const { description, amount, currency, paid_by, split_type, participants, split_details, date, notes } = req.body;

    // Validation
    if (!description || amount === undefined || !split_type || !participants || participants.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Description, amount, split type, and participants are required.' });
    }

    if (amount === 0) {
      client.release();
      return res.status(400).json({ error: 'Amount cannot be zero.' });
    }

    // Set schema and start transaction explicitly on this client
    await client.query('SET search_path TO spreetail, public');
    await client.query('BEGIN');

    // Insert the expense
    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, description, amount, currency, paid_by, split_type, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        groupId,
        description.trim(),
        Math.round(Math.abs(amount) * 100) / 100,  // store absolute value, rounded
        currency || 'INR',
        paid_by || null,
        split_type,
        date || new Date().toISOString().split('T')[0],
        notes || null
      ]
    );

    const expense = expenseResult.rows[0];

    // Calculate splits and insert them
    const splits = calculateSplits(
      parseFloat(expense.amount),
      split_type,
      participants,
      split_details || {}
    );

    // Insert each person's split
    for (const [userId, amountOwed] of Object.entries(splits)) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)',
        [expense.id, userId, amountOwed]
      );
    }

    await client.query('COMMIT');
    client.release();

    res.status(201).json({
      message: 'Expense created',
      expense,
      splits
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Create expense error:', err);
    res.status(500).json({ error: 'Failed to create expense.' });
  }
});

// GET /api/groups/:id/expenses
// List all expenses for a group (with split details)
router.get('/:id/expenses', async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const result = await query(
      `SELECT e.*, 
              u.name AS paid_by_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'user_id', es.user_id,
                    'user_name', su.name,
                    'amount_owed', es.amount_owed
                  )
                ) FILTER (WHERE es.id IS NOT NULL),
                '[]'
              ) AS splits
       FROM expenses e
       LEFT JOIN users u ON e.paid_by = u.id
       LEFT JOIN expense_splits es ON e.id = es.expense_id
       LEFT JOIN users su ON es.user_id = su.id
       WHERE e.group_id = $1 AND e.is_settlement = FALSE
       GROUP BY e.id, u.name
       ORDER BY e.date DESC, e.created_at DESC`,
      [groupId]
    );

    res.json({ expenses: result.rows });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
});

// GET /api/groups/:id/expenses/:expenseId
// Get single expense detail
router.get('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const { expenseId } = req.params;

    const result = await query(
      `SELECT e.*, 
              u.name AS paid_by_name,
              COALESCE(
                json_agg(
                  json_build_object(
                    'user_id', es.user_id,
                    'user_name', su.name,
                    'amount_owed', es.amount_owed
                  )
                ) FILTER (WHERE es.id IS NOT NULL),
                '[]'
              ) AS splits
       FROM expenses e
       LEFT JOIN users u ON e.paid_by = u.id
       LEFT JOIN expense_splits es ON e.id = es.expense_id
       LEFT JOIN users su ON es.user_id = su.id
       WHERE e.id = $1
       GROUP BY e.id, u.name`,
      [expenseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    res.json({ expense: result.rows[0] });
  } catch (err) {
    console.error('Get expense error:', err);
    res.status(500).json({ error: 'Failed to fetch expense.' });
  }
});

// DELETE /api/groups/:id/expenses/:expenseId
// Delete an expense and its splits
router.delete('/:id/expenses/:expenseId', async (req, res) => {
  try {
    const { expenseId } = req.params;

    // Splits are deleted automatically via ON DELETE CASCADE
    const result = await query(
      'DELETE FROM expenses WHERE id = $1 RETURNING id',
      [expenseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

module.exports = router;
