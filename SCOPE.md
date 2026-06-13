# SCOPE.md — Anomaly Log & Database Schema

## CSV Anomalies Found

I found **19 data problems** in `Expenses Export.csv`. Below is every anomaly, how my importer detects it, and what action is taken.

---

### 1. Exact Duplicate — Marina Bites Dinner (Rows 5-6)

| Field | Row 5 | Row 6 |
|-------|-------|-------|
| Date | 08-02-2026 | 08-02-2026 |
| Description | Dinner at Marina Bites | dinner - marina bites |
| Paid by | Dev | Dev |
| Amount | 3200 | 3200 |

**Detection**: Same date + same payer + same amount + description similarity (normalized comparison using bigram similarity).  
**Action**: Row 5 is kept (it has context in notes). Row 6 is flagged as `EXACT_DUPLICATE` and skipped during import.

### 2. Comma-Formatted Amount (Row 7)

Amount field contains `"1,200"` instead of `1200`.  
**Detection**: Check for comma characters in amount string.  
**Action**: Comma removed, parsed as 1200. Logged as `COMMA_IN_AMOUNT` with severity `info`.

### 3. Lowercase Name (Row 9)

Paid by field is `priya` (lowercase) instead of `Priya`.  
**Detection**: Case-insensitive match against known member names.  
**Action**: Normalized to `Priya`. Logged as `PAYER_NAME_NORMALIZED`.

### 4. Excessive Decimal Precision (Row 10)

Amount is `899.995` — 3 decimal places.  
**Detection**: Check if decimal portion has more than 2 digits.  
**Action**: Rounded to `900.00` (standard 2-decimal rounding). Logged as `EXCESSIVE_DECIMALS`.

### 5. Name Variant (Row 11)

Paid by is `Priya S` instead of `Priya`.  
**Detection**: First-name extraction + case-insensitive match against known names.  
**Action**: Mapped to `Priya`. Logged as `PAYER_NAME_NORMALIZED`.

### 6. Missing Payer (Row 13)

The `paid_by` field is empty. Note says "can't remember who paid".  
**Detection**: Check for empty/null `paid_by` field.  
**Action**: Flagged as `MISSING_PAYER` with severity `error`. Expense is imported with null payer — it affects balance calculation since no one gets credit for paying.

### 7. Settlement Logged as Expense (Row 14)

"Rohan paid Aisha back" with ₹5000, empty split_type.  
**Detection**: Check for empty split_type + description contains "paid" and "back".  
**Action**: Classified as `SETTLEMENT_AS_EXPENSE`. Moved to the settlements table instead of expenses. Rohan→Aisha ₹5000.

### 8. Percentages Sum to 110% (Row 15)

Split details: `Aisha 30%; Rohan 30%; Priya 30%; Meera 20%` = 110%.  
**Detection**: Sum all percentages and check if total ≠ 100.  
**Action**: Percentages are normalized proportionally (each scaled by 100/110). Logged as `PERCENTAGE_SUM_ERROR`.

### 9. Conflicting Duplicate — Thalassa Dinner (Rows 24-25)

| Field | Row 24 | Row 25 |
|-------|--------|--------|
| Description | Dinner at Thalassa | Thalassa dinner |
| Paid by | Aisha | Rohan |
| Amount | 2400 | 2450 |
| Note | — | "Aisha also logged this I think hers is wrong" |

**Detection**: Same date + description similarity but different amounts.  
**Action**: Flagged as `CONFLICTING_DUPLICATE` with severity `error`. Both rows shown to user for review. Rohan's note suggests Aisha's entry is wrong — user decides which to keep.

### 10. Negative Amount / Refund (Row 26)

Amount is `-30` USD for "Parasailing refund".  
**Detection**: Check for negative amount value.  
**Action**: Treated as a legitimate refund (description confirms "refund"). Imported with negative split amounts — effectively credits participants. Logged as `NEGATIVE_AMOUNT`.

### 11. Malformed Date (Row 27)

Date is `Mar-14` instead of DD-MM-YYYY.  
**Detection**: Regex matching for month-name format (`[A-Za-z]{3}-\d{1,2}`).  
**Action**: Parsed as `14-03-2026`. Logged as `MALFORMED_DATE`.

### 12. Trailing Space in Name (Row 27)

Paid by is `rohan ` (lowercase + trailing space).  
**Detection**: Trimming + case-insensitive matching.  
**Action**: Normalized to `Rohan`. Logged as `PAYER_NAME_NORMALIZED`.

### 13. Missing Currency (Row 28)

Currency field is empty. Note says "forgot to set currency".  
**Detection**: Check for empty currency field.  
**Action**: Defaulted to `INR` (most common currency in the dataset). Logged as `MISSING_CURRENCY`.

### 14. Zero Amount Placeholder (Row 31)

Amount is `0` with note "counted twice earlier - fixing later".  
**Detection**: Check for amount === 0.  
**Action**: Flagged as `ZERO_AMOUNT` and skipped during import. This is clearly a placeholder entry.

### 15. Ambiguous Date (Row 34)

Date is `04-05-2026`. Note says "is this April 5 or May 4? format is a mess".  
**Detection**: Check if note mentions date ambiguity keywords.  
**Action**: Interpreted as DD-MM-YYYY (April 5, 2026) to maintain consistency with the rest of the CSV. Logged as `AMBIGUOUS_DATE`.

### 16. Stale Member After Leaving (Row 36)

Meera is included in April 2 groceries, but she moved out on March 31 (Row 33 note: "Meera moving out Sunday").  
**Detection**: Compare expense date against Meera's leave date (2026-03-31).  
**Action**: Meera is removed from this expense's split. Logged as `STALE_MEMBER`. Amount is recalculated among remaining active participants.

### 17. Contradictory Split Info (Row 42)

`split_type` is `equal` but `split_details` contains `Aisha 1; Rohan 1; Priya 1; Sam 1`.  
**Detection**: Check if split_type is "equal" but split_details is non-empty.  
**Action**: Split type takes precedence — equal split is used, details are ignored. Logged as `CONTRADICTORY_SPLIT`.

### 18. Ad-hoc/Guest Participant (Row 23)

`Dev's friend Kabir` appears in the split_with for parasailing.  
**Detection**: Check for patterns like "'s friend" in participant names.  
**Action**: Kabir is created as a guest/temporary user. Logged as `ADHOC_PARTICIPANT`.

### 19. Multi-Currency Without Conversion (Rows 20-21, 23, 26)

Several expenses are in USD (villa booking $540, beach lunch $84, parasailing $150) but the CSV doesn't convert them.  
**Detection**: Presence of `USD` in currency field.  
**Action**: Stored in original currency. For balance calculations, converted to INR at a fixed rate of ₹83/$1 (documented in DECISIONS.md).

---

## Database Schema

### Tables

#### `users`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| name | VARCHAR(100) | Display name |
| email | VARCHAR(255) UNIQUE | Login email |
| password_hash | VARCHAR(255) | bcrypt hashed password |
| created_at | TIMESTAMP | Account creation time |

#### `groups`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| name | VARCHAR(100) | Group name (e.g., "Flat 4B") |
| description | TEXT | Optional description |
| created_by | UUID (FK→users) | Group creator |
| created_at | TIMESTAMP | Creation time |

#### `group_members`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| group_id | UUID (FK→groups) | Which group |
| user_id | UUID (FK→users) | Which user |
| joined_at | DATE | When they joined (for Sam: 2026-04-08) |
| left_at | DATE | When they left (for Meera: 2026-03-31), NULL if active |

This table enables **time-bounded membership** — Sam isn't charged for March expenses, and Meera isn't charged for April expenses.

#### `expenses`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| group_id | UUID (FK→groups) | Which group |
| description | VARCHAR(255) | What the expense was for |
| amount | DECIMAL(12,2) | Total amount (positive, even for refunds) |
| currency | VARCHAR(3) | INR or USD |
| paid_by | UUID (FK→users) | Who paid (nullable for missing payer) |
| split_type | VARCHAR(20) | equal, unequal, percentage, or share |
| date | DATE | Expense date |
| notes | TEXT | Optional notes |
| is_settlement | BOOLEAN | Distinguishes settlements from expenses |
| created_at | TIMESTAMP | Record creation time |

#### `expense_splits`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| expense_id | UUID (FK→expenses) | Which expense |
| user_id | UUID (FK→users) | Which participant |
| amount_owed | DECIMAL(12,2) | Calculated share amount |

#### `settlements`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| group_id | UUID (FK→groups) | Which group |
| from_user | UUID (FK→users) | Who paid |
| to_user | UUID (FK→users) | Who received |
| amount | DECIMAL(12,2) | Settlement amount |
| currency | VARCHAR(3) | INR or USD |
| date | DATE | Settlement date |
| notes | TEXT | Optional notes |

#### `import_reports`
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | Unique identifier |
| group_id | UUID (FK→groups) | Which group |
| uploaded_by | UUID (FK→users) | Who uploaded |
| filename | VARCHAR(255) | Original filename |
| total_rows | INTEGER | Rows in CSV |
| imported_rows | INTEGER | Successfully imported |
| skipped_rows | INTEGER | Skipped (duplicates, zeros, etc.) |
| anomalies_count | INTEGER | Total anomalies detected |
| status | VARCHAR(20) | pending, completed, failed |
| report_data | JSONB | Full anomaly report |
