const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// POST /api/groups/:id/settlements
// Record a settlement (one person paying another)
router.post('/:id/settlements', async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { from_user, to_user, amount, currency, date, notes } = req.body;

    if (!from_user || !to_user || !amount) {
      return res.status(400).json({ error: 'from_user, to_user, and amount are required.' });
    }

    if (from_user === to_user) {
      return res.status(400).json({ error: 'Cannot settle with yourself.' });
    }

    const result = await query(
      `INSERT INTO settlements (group_id, from_user, to_user, amount, currency, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        groupId,
        from_user,
        to_user,
        Math.round(parseFloat(amount) * 100) / 100,
        currency || 'INR',
        date || new Date().toISOString().split('T')[0],
        notes || null
      ]
    );

    res.status(201).json({ message: 'Settlement recorded', settlement: result.rows[0] });
  } catch (err) {
    console.error('Create settlement error:', err);
    res.status(500).json({ error: 'Failed to record settlement.' });
  }
});

// GET /api/groups/:id/settlements
// List all settlements in a group
router.get('/:id/settlements', async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const result = await query(
      `SELECT s.*, 
              fu.name AS from_name, 
              tu.name AS to_name
       FROM settlements s
       JOIN users fu ON s.from_user = fu.id
       JOIN users tu ON s.to_user = tu.id
       WHERE s.group_id = $1
       ORDER BY s.date DESC`,
      [groupId]
    );

    res.json({ settlements: result.rows });
  } catch (err) {
    console.error('List settlements error:', err);
    res.status(500).json({ error: 'Failed to fetch settlements.' });
  }
});

module.exports = router;
