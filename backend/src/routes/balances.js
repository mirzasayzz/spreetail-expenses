const express = require('express');
const { authenticate } = require('../middleware/auth');
const { calculateGroupBalances, calculateSettlements } = require('../utils/balanceCalculator');

const router = express.Router();

router.use(authenticate);

// GET /api/groups/:id/balances
// Returns net balance for every member in the group
// Positive = others owe you, Negative = you owe others
router.get('/:id/balances', async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const balances = await calculateGroupBalances(groupId);

    // Also calculate simplified settlement plan (Aisha's request)
    const settlementPlan = await calculateSettlements(groupId);

    res.json({
      balances,
      settlement_plan: settlementPlan,
      currency: 'INR',
      note: 'All amounts converted to INR. USD expenses converted at fixed rate.'
    });
  } catch (err) {
    console.error('Balance calculation error:', err);
    res.status(500).json({ error: 'Failed to calculate balances.' });
  }
});

// GET /api/groups/:id/balances/:userId
// Returns detailed balance breakdown for a specific user (Rohan's request)
// Shows exactly which expenses contribute to the balance
router.get('/:id/balances/:userId', async (req, res) => {
  try {
    const { id: groupId, userId } = req.params;
    const allBalances = await calculateGroupBalances(groupId);

    const userBalance = allBalances.find(b => b.user_id === userId);

    if (!userBalance) {
      return res.status(404).json({ error: 'User not found in this group.' });
    }

    res.json({
      balance: userBalance,
      currency: 'INR'
    });
  } catch (err) {
    console.error('User balance error:', err);
    res.status(500).json({ error: 'Failed to get user balance.' });
  }
});

module.exports = router;
