# AI Usage & Verification Log

For this assignment, I used a couple of AI tools to speed up my workflow:
* **Claude 3.5 Sonnet**: Used for planning the general full-stack structure, database schema layout, and debugging connection/query edge cases.
* **GitHub Copilot**: Used as an inline autocomplete assistant in my editor to write boilerplates (like basic React UI divs and Express route registration) faster.
* **Google/MDN**: Used to search for specific syntax examples for the PostgreSQL `pg` pool library and CORS setup.

---

## Key Areas Where I Queried AI

1. **Database Schema Design**: 
   I asked for suggestions on how to track flatmate group expenses where people join or leave at different times. The advice was to use a dedicated association table (`group_members`) with `joined_at` and `left_at` date columns rather than simple array fields. This made it possible to handle time-bounded splits dynamically.

2. **CSV Parser Boilerplate**:
   I generated a basic template function to read CSV rows and flag anomalies. I had to heavily customize the validation rules to cover the specific edge cases (like normalized Jaccard similarity for descriptions, as detailed below).

3. **Simplified Settlements**:
   I queried how to calculate a simplified "who pays whom" debt plan. The suggestion was a greedy algorithm that matches the largest debtors with the largest creditors, which worked perfectly for Aisha's requirement of "one number per person."

4. **Percentage Math Adjustments**:
   I verified the math for normalizing splits (e.g., when percentages sum to 110%). I chose a proportional scaling approach and added a rounding adjustment so the shares always equal the exact bill total.

---

## Debugging Cases (Where the AI Made Mistakes)

Working with AI generated code requires careful verification. Below are four specific scenarios where the AI's suggestions were incorrect or incomplete, how I found the bugs, and how I resolved them.

### Case 1: Overly Aggressive Duplicate Detection
* **What the AI did**: The initial duplicate check suggested comparing only the date and the amount. If two rows had the exact same date and amount, it flagged them as duplicate.
* **How I caught it**: Manually reviewing the `Expenses Export.csv`, I noticed that different expenses can easily share the same date and cost (e.g., two separate groceries runs). Also, the Thalassa dinner rows (rows 24 and 25) had different amounts (₹2400 and ₹2450) and different payers, which a simple date/amount match would miss entirely.
* **My fix**: I updated the parser in `csvParser.js` to normalize and compare descriptions using bigram similarity. If the text similarity is above 60% and dates match, they are flagged. If the amounts or payers differ, the system classifies them as a `CONFLICTING_DUPLICATE` (requiring manual review) rather than auto-skipping them as an exact copy.

### Case 2: Omission of Multi-Currency Conversion
* **What the AI did**: When generating the balance calculator, the AI wrote code that directly summed up the `amount` values of all splits, completely ignoring the currency column.
* **How I caught it**: When I ran a test run on the Goa trip expenses, the numbers looked completely off. Dev had paid $540 for the villa booking and $150 for parasailing, but the app was adding $660 to other members' ₹48,000 rent splits as if dollars and rupees were equal. Dev appeared to owe money when he was actually the largest creditor.
* **My fix**: I added a currency check helper `toINR()` using a fixed conversion rate (₹83 per USD) configured in the backend `.env`. I applied this conversion to both the total payments and individual splits so that all balances are cleanly resolved in a single currency (INR).

### Case 3: Inaccurate Settlement Detection
* **What the AI did**: To identify direct payments (settlements) in the CSV rather than regular expenses, the AI code simply looked for the word "settlement" in the description.
* **How I caught it**: Row 14 in the CSV is "Rohan paid Aisha back" with a note saying "this is a settlement not an expense??" The word "settlement" does not appear in the description. The AI's code would have imported this as a regular expense, making it look like Rohan paid a new group expense instead of settling his existing debt.
* **My fix**: I modified the parser to check for two structural indicators:
  1. An empty `split_type` field (settlements don't have split types).
  2. The description containing natural language patterns like "paid" and "back" concurrently.
  This correctly separates row 14 and records it as a direct transfer in the `settlements` table.

### Case 4: Percentage Split Rounding Discrepancies
* **What the AI did**: The AI suggested calculating split shares by multiplying the amount by the percentage, but rounded each share independently.
* **How I caught it**: I calculated the splits for Pizza Friday (₹1,440) split four ways with normalized percentages (27.27%, 27.27%, 27.27%, 18.18%). Summing the shares: `392.73 + 392.73 + 392.73 + 261.79 = 1439.98`. We were missing 2 paisa.
* **My fix**: I updated the split calculator logic to track the running sum of allocated shares and assign the remaining fraction of a rupee (the difference between the bill total and the sum of splits) to the first participant. This guarantees that splits always sum exactly to the expense amount down to the last decimal.
