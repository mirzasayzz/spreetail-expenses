const express = require('express');
const multer = require('multer');
const { query, pool } = require('../db');
const { authenticate } = require('../middleware/auth');
const { parseExpensesCSV } = require('../utils/csvParser');
const { calculateSplits } = require('../utils/splitCalculator');

const router = express.Router();
router.use(authenticate);

// Use memory storage for CSV uploads (no disk files to clean up)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// POST /api/groups/:id/import
// Upload and parse CSV, detect anomalies, return report for review
router.post('/:id/import', upload.single('file'), async (req, res) => {
  try {
    const { id: groupId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded.' });
    }

    // Parse CSV content from the uploaded buffer
    const csvContent = req.file.buffer.toString('utf-8');
    const parseResult = parseExpensesCSV(csvContent);

    // Save the import report to the database
    const reportResult = await query(
      `INSERT INTO import_reports (group_id, uploaded_by, filename, total_rows, anomalies_count, status, report_data)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
      [
        groupId,
        req.user.id,
        req.file.originalname,
        parseResult.summary.total_rows,
        parseResult.summary.total_anomalies,
        JSON.stringify(parseResult)
      ]
    );

    res.json({
      message: 'CSV parsed successfully. Review anomalies before confirming import.',
      report_id: reportResult.rows[0].id,
      summary: parseResult.summary,
      anomalies: parseResult.anomalies,
      rows: parseResult.rows
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Failed to parse CSV: ' + err.message });
  }
});

// POST /api/groups/:id/import/confirm
// Apply the parsed CSV data into the database after user reviews anomalies
router.post('/:id/import/confirm', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: groupId } = req.params;
    const { report_id, excluded_rows } = req.body;
    // excluded_rows: array of row numbers the user wants to skip

    if (!report_id) {
      client.release();
      return res.status(400).json({ error: 'report_id is required.' });
    }

    // Set search_path and start transaction explicitly on this client
    await client.query('SET search_path TO spreetail, public');
    await client.query('BEGIN');

    // Fetch the saved parse result
    const reportResult = await client.query(
      'SELECT * FROM import_reports WHERE id = $1 AND group_id = $2',
      [report_id, groupId]
    );

    if (reportResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Import report not found.' });
    }

    const parseResult = reportResult.rows[0].report_data;
    const excludeSet = new Set(excluded_rows || []);

    // We need to map CSV names to actual user IDs in the database
    // First, get or create users for all participants
    const nameToUserId = {};

    // Collect all unique names from the CSV
    const allNames = new Set();
    parseResult.rows.forEach(row => {
      if (row.paid_by) allNames.add(row.paid_by);
      row.participants.forEach(p => allNames.add(p));
    });

    // Map each name to a user ID (find existing or create placeholder)
    for (const name of allNames) {
      // Handle special cases like "Dev's friend Kabir"
      const cleanName = name.replace(/['']s friend /i, '').trim();
      
      const userResult = await client.query(
        'SELECT id FROM users WHERE LOWER(name) = LOWER($1)',
        [cleanName]
      );

      if (userResult.rows.length > 0) {
        nameToUserId[name] = userResult.rows[0].id;
      } else {
        // Create a placeholder user for this person
        const email = `${cleanName.toLowerCase().replace(/\s+/g, '.')}@placeholder.local`;
        const newUser = await client.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = $1 RETURNING id',
          [cleanName, email, 'placeholder_no_login']
        );
        nameToUserId[name] = newUser.rows[0].id;

        // Add them as a group member
        await client.query(
          'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [groupId, newUser.rows[0].id, '2026-02-01']
        );
      }
    }

    // Set membership dates for known people
    // Meera left end of March
    if (nameToUserId['Meera']) {
      await client.query(
        'UPDATE group_members SET left_at = $1 WHERE group_id = $2 AND user_id = $3 AND left_at IS NULL',
        ['2026-03-31', groupId, nameToUserId['Meera']]
      );
    }
    // Sam joined mid-April
    if (nameToUserId['Sam']) {
      await client.query(
        'UPDATE group_members SET joined_at = $1 WHERE group_id = $2 AND user_id = $3',
        ['2026-04-08', groupId, nameToUserId['Sam']]
      );
    }

    // Now import each row
    let importedCount = 0;
    let skippedCount = 0;
    let settlementCount = 0;

    for (const row of parseResult.rows) {
      // Skip excluded rows
      if (excludeSet.has(row.rowNumber)) {
        skippedCount++;
        continue;
      }

      // Skip duplicates
      if (row.isDuplicate) {
        skippedCount++;
        continue;
      }

      // Skip zero-amount rows
      if (row.amount === 0) {
        skippedCount++;
        continue;
      }

      // Handle settlements separately
      if (row.isSettlement) {
        const fromUserId = nameToUserId[row.paid_by];
        const toUserId = row.participants.length > 0 ? nameToUserId[row.participants[0]] : null;

        if (fromUserId && toUserId) {
          await client.query(
            `INSERT INTO settlements (group_id, from_user, to_user, amount, currency, date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [groupId, fromUserId, toUserId, Math.abs(row.amount), row.currency, row.date, row.notes]
          );
          settlementCount++;
        }
        continue;
      }

      // Filter out stale members from participants
      let activeParticipants = row.participants;
      if (row.date) {
        const expenseDate = new Date(row.date);
        const meeraLeft = new Date('2026-03-31');
        
        if (expenseDate > meeraLeft) {
          activeParticipants = activeParticipants.filter(p => p !== 'Meera');
        }
      }

      // Map participant names to user IDs
      const participantIds = activeParticipants
        .map(name => nameToUserId[name])
        .filter(Boolean);

      if (participantIds.length === 0) continue;

      // Map split details to user IDs
      const splitDetailsById = {};
      for (const [name, value] of Object.entries(row.splitDetails || {})) {
        const userId = nameToUserId[name];
        if (userId) splitDetailsById[userId] = value;
      }

      // Handle negative amounts (refunds)
      const isRefund = row.amount < 0;
      const absAmount = Math.abs(row.amount);

      // Insert expense
      const paidByUserId = nameToUserId[row.paid_by] || null;
      const expenseResult = await client.query(
        `INSERT INTO expenses (group_id, description, amount, currency, paid_by, split_type, date, notes, is_settlement)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE) RETURNING id`,
        [
          groupId,
          row.description + (isRefund ? ' (refund)' : ''),
          absAmount,
          row.currency,
          paidByUserId,
          row.split_type || 'equal',
          row.date,
          row.notes || null
        ]
      );

      const expenseId = expenseResult.rows[0].id;

      // Calculate and insert splits
      const splits = calculateSplits(absAmount, row.split_type || 'equal', participantIds, splitDetailsById);

      for (const [userId, amountOwed] of Object.entries(splits)) {
        // For refunds, the split amount is negative (money coming back)
        const finalAmount = isRefund ? -amountOwed : amountOwed;
        await client.query(
          'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)',
          [expenseId, userId, finalAmount]
        );
      }

      importedCount++;
    }

    // Update the import report status
    await client.query(
      `UPDATE import_reports SET status = 'completed', imported_rows = $1, skipped_rows = $2 WHERE id = $3`,
      [importedCount, skippedCount, report_id]
    );

    await client.query('COMMIT');
    client.release();

    res.json({
      message: 'Import completed',
      imported: importedCount,
      skipped: skippedCount,
      settlements: settlementCount,
      total: parseResult.rows.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Import confirm error:', err);
    res.status(500).json({ error: 'Failed to import data: ' + err.message });
  }
});

// GET /api/groups/:id/import/reports
// List all import reports for a group
router.get('/:id/import/reports', async (req, res) => {
  try {
    const { id: groupId } = req.params;

    const result = await query(
      `SELECT id, filename, total_rows, imported_rows, skipped_rows, anomalies_count, status, created_at,
              report_data->'summary' AS summary,
              report_data->'anomalies' AS anomalies
       FROM import_reports 
       WHERE group_id = $1 
       ORDER BY created_at DESC`,
      [groupId]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    console.error('List reports error:', err);
    res.status(500).json({ error: 'Failed to fetch import reports.' });
  }
});

module.exports = router;
