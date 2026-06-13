const express = require('express');
const { query, pool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All group routes require authentication
router.use(authenticate);

// POST /api/groups
// Create a new expense group
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description } = req.body;

    if (!name) {
      client.release();
      return res.status(400).json({ error: 'Group name is required.' });
    }

    // Set schema and start transaction explicitly on this client
    await client.query('SET search_path TO spreetail, public');
    await client.query('BEGIN');

    // Create the group
    const groupResult = await client.query(
      'INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description || '', req.user.id]
    );

    const group = groupResult.rows[0];

    // Add creator as a member
    await client.query(
      'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, CURRENT_DATE)',
      [group.id, req.user.id]
    );

    await client.query('COMMIT');
    client.release();

    res.status(201).json({ message: 'Group created', group });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group.' });
  }
});

// GET /api/groups
// List all groups the user belongs to
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT g.*, 
              gm.joined_at, gm.left_at,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND left_at IS NULL) AS member_count,
              (SELECT COUNT(*) FROM expenses WHERE group_id = g.id) AS expense_count
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );

    res.json({ groups: result.rows });
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

// GET /api/groups/:id
// Get group details with members
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get group info
    const groupResult = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    // Get all members with their details
    const membersResult = await query(
      `SELECT u.id, u.name, u.email, gm.joined_at, gm.left_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [id]
    );

    res.json({
      group: groupResult.rows[0],
      members: membersResult.rows
    });
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Failed to fetch group.' });
  }
});

// POST /api/groups/:id/members
// Add a member to the group (by email)
router.post('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, joined_at } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Find the user by email
    const userResult = await query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email. They need to register first.' });
    }

    const targetUser = userResult.rows[0];

    // Check if already a member
    const existingMember = await query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [id, targetUser.id]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'This user is already an active member.' });
    }

    // Add as member
    const joinDate = joined_at || new Date().toISOString().split('T')[0];
    await query(
      'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, $3)',
      [id, targetUser.id, joinDate]
    );

    res.status(201).json({
      message: `${targetUser.name} added to the group`,
      member: { ...targetUser, joined_at: joinDate, left_at: null }
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// PATCH /api/groups/:id/members/:userId
// Update member info (e.g., set leave date)
router.patch('/:id/members/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { left_at } = req.body;

    const result = await query(
      'UPDATE group_members SET left_at = $1 WHERE group_id = $2 AND user_id = $3 AND left_at IS NULL RETURNING *',
      [left_at, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active membership not found.' });
    }

    res.json({ message: 'Membership updated', member: result.rows[0] });
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Failed to update member.' });
  }
});

module.exports = router;
