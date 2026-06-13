# DECISIONS.md — Decision Log

Every significant decision made during development, with alternatives considered and reasoning.

---

### Decision 1: Tech Stack — React + Node.js + PostgreSQL

**Options considered:**
1. Next.js (full-stack) + Supabase
2. React (Vite) + Express + PostgreSQL ← **Chosen**
3. Django + PostgreSQL
4. Spring Boot + MySQL

**Why I chose Option 2:**
- Clearer separation between frontend and backend (easier to explain each part independently)
- Express gives full control over API logic without framework magic
- PostgreSQL on Supabase gives a managed relational database with free tier
- React + Vite is lightweight and fast for development
- I'm most comfortable explaining JavaScript/Node.js code line by line

**Trade-off:** No SSR/SEO benefits from Next.js, but this is an internal tool — SEO doesn't matter.

---

### Decision 2: Currency Conversion — Fixed Rate vs API

**Options considered:**
1. Real-time exchange rate API (e.g., exchangerate-api.com)
2. Fixed exchange rate (₹83/$1) ← **Chosen**
3. Let users input the rate manually per expense

**Why I chose Option 2:**
- The Goa trip was in March 2026. The expenses are historical — a real-time rate would give today's rate, not the rate when they actually spent the money.
- A fixed rate is deterministic and reproducible — the same balance is shown every time.
- The rate (₹83/$1) is stored in `.env` and can be easily changed.
- If we wanted the actual historical rate, we'd need a more complex API and to store the rate per expense.

**Trade-off:** The conversion isn't perfectly accurate, but it's consistent and transparent.

---

### Decision 3: Duplicate Resolution — User Review vs Auto-Delete

**Options considered:**
1. Auto-delete duplicates silently
2. Flag duplicates and let user review ← **Chosen**
3. Keep both and tag as "possible duplicate"

**Why I chose Option 2:**
- Meera specifically requested: "Clean up the duplicates — but I want to approve anything the app deletes or changes."
- Silent deletion violates user trust and could accidentally delete valid expenses.
- For the Marina Bites exact duplicate (rows 5-6), the system auto-skips because they're identical.
- For the Thalassa conflicting duplicate (rows 24-25, different amounts), the system flags both for user decision.

---

### Decision 4: Negative Amounts — Refund vs Error

**Options considered:**
1. Treat all negative amounts as errors and reject them
2. Treat negative amounts as refunds/credits ← **Chosen**
3. Take absolute value and ignore the sign

**Why I chose Option 2:**
- Row 26: "Parasailing refund, -30 USD, one slot got cancelled" — the description and context clearly indicate a refund.
- Refunds are a legitimate part of expense tracking. Ignoring the sign would inflate everyone's balance.
- The system creates the expense with a positive amount but applies negative split values, effectively crediting participants.

---

### Decision 5: Missing Payer — Skip vs Flag

**Options considered:**
1. Skip the row entirely
2. Flag for manual assignment ← **Chosen**
3. Assign to a random/first member

**Why I chose Option 2:**
- Row 13 has ₹780 of cleaning supplies with no payer. Skipping it means that money disappears from everyone's records.
- Assigning to a random member would be unfair and inaccurate.
- Flagging it ensures the data is imported but marked as incomplete — a human can fix it later.
- The expense is stored with `paid_by = NULL`, which means no one gets credit for paying until it's resolved.

---

### Decision 6: Percentage Overflow — Normalize vs Reject

**Options considered:**
1. Reject the row and ask for correction
2. Normalize proportionally ← **Chosen**
3. Use the percentages as-is (let them sum to 110%)

**Why I chose Option 2:**
- Row 15 percentages sum to 110%. The note says "percentages might be off."
- Normalizing preserves the relative proportions: if Meera was meant to pay less (20%), she still pays less than the others.
- Formula: `new_pct = old_pct × (100 / total_sum)`. So 30% becomes 27.27%, 20% becomes 18.18%.
- Rejecting would mean losing the expense. Using as-is would overcharge everyone by 10%.

---

### Decision 7: Ambiguous Date (04-05-2026) — DD-MM vs MM-DD

**Options considered:**
1. Interpret as DD-MM-YYYY (April 5) ← **Chosen**
2. Interpret as MM-DD-YYYY (May 4)
3. Flag and skip

**Why I chose Option 1:**
- Every other date in the CSV follows DD-MM-YYYY format (Indian convention).
- Consistency is key — switching formats mid-file would be confusing.
- The note "is this April 5 or May 4? format is a mess" shows even the author was unsure, but DD-MM matches all surrounding rows.
- This decision is documented and can be changed if needed.

---

### Decision 8: Stale Members — Auto-Remove vs Flag

**Options considered:**
1. Silently include stale members in the split
2. Auto-remove stale members and recalculate ← **Chosen**
3. Flag for user review

**Why I chose Option 2:**
- Sam's request: "I moved in mid-April. Why would March electricity affect my balance?"
- The `group_members` table tracks `joined_at` and `left_at` dates.
- During import, if Meera appears in an April expense (after her `left_at` of March 31), she's automatically removed from that expense's split.
- Row 36 even has the note "oops Meera still in the group list" — confirming this is a data entry mistake.

---

### Decision 9: Settlements — Same Table vs Separate Table

**Options considered:**
1. Store settlements in the expenses table with a boolean flag
2. Separate settlements table ← **Chosen**

**Why I chose Option 2:**
- Settlements are conceptually different from expenses — they're direct transfers between two people.
- An expense has splits among multiple people; a settlement is always from one person to exactly one other.
- Separate tables make queries cleaner: "show me all expenses" doesn't include settlements.
- The balance calculator processes expenses and settlements differently.

---

### Decision 10: Rounding Strategy — Last Person Gets Remainder

**Options considered:**
1. Round each share independently (might not sum to total)
2. Give remainder to the last person ← **Chosen**
3. Give remainder to the payer
4. Distribute remainder across all participants

**Why I chose Option 2:**
- When splitting ₹100 three ways: 33.33 + 33.33 + 33.34 = 100.00.
- The last person in the list absorbs the rounding difference (usually just ₹0.01).
- This ensures the sum of all splits always equals the total amount.
- Simple, deterministic, and easy to explain.

---

### Decision 11: Guest Participants — Create User vs Ignore

**Options considered:**
1. Ignore unknown participants
2. Create placeholder users ← **Chosen**
3. Add a separate "guests" field

**Why I chose Option 2:**
- "Dev's friend Kabir" (row 23) participated in parasailing. Ignoring him would change everyone else's share.
- Creating a placeholder user with a local-only email lets the system track Kabir's share properly.
- If Kabir ever registers, his account could be linked to the placeholder.

---

### Decision 12: Import Flow — Two-Phase (Parse + Confirm)

**Options considered:**
1. Single-step: upload and immediately import
2. Two-phase: parse → review anomalies → confirm import ← **Chosen**

**Why I chose Option 2:**
- Meera's request: "I want to approve anything the app deletes or changes."
- Phase 1 (POST `/import`): Parses CSV, detects all anomalies, returns a report for review.
- Phase 2 (POST `/import/confirm`): User reviews anomalies, optionally excludes specific rows, then confirms.
- This ensures no data is modified without the user's knowledge.
