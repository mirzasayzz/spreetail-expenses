/**
 * Split Calculator
 * Calculates how much each participant owes based on the split type.
 * 
 * Split types from the CSV:
 *   - equal:      everyone pays the same amount
 *   - unequal:    specific amounts per person (from split_details)
 *   - percentage: each person pays a percentage (from split_details)
 *   - share:      ratio-based splitting (e.g. Rohan 2, Priya 1 means Rohan pays 2x)
 */

/**
 * Calculate split amounts for an expense
 * @param {number} totalAmount - Total expense amount
 * @param {string} splitType - Type of split: equal, unequal, percentage, share
 * @param {string[]} participants - Array of participant user IDs
 * @param {Object} splitDetails - Key-value pairs of userId: value (for non-equal splits)
 * @returns {Object} Map of userId -> amount they owe
 */
function calculateSplits(totalAmount, splitType, participants, splitDetails = {}) {
  const splits = {};

  switch (splitType) {
    case 'equal': {
      // Divide equally among all participants
      const perPerson = Math.round((totalAmount / participants.length) * 100) / 100;
      
      // Handle rounding remainder - give it to the first person
      // e.g., 100 split 3 ways = 33.33 + 33.33 + 33.34
      let remaining = totalAmount;
      participants.forEach((userId, index) => {
        if (index === participants.length - 1) {
          // Last person gets the remainder to ensure total matches
          splits[userId] = Math.round(remaining * 100) / 100;
        } else {
          splits[userId] = perPerson;
          remaining -= perPerson;
        }
      });
      break;
    }

    case 'unequal': {
      // Each person has a specific amount from splitDetails
      participants.forEach((userId) => {
        splits[userId] = parseFloat(splitDetails[userId]) || 0;
      });
      break;
    }

    case 'percentage': {
      // Each person pays a percentage of the total
      // First, check if percentages sum to 100 - if not, normalize them
      let totalPercentage = 0;
      participants.forEach((userId) => {
        totalPercentage += parseFloat(splitDetails[userId]) || 0;
      });

      participants.forEach((userId) => {
        let pct = parseFloat(splitDetails[userId]) || 0;
        
        // Normalize if percentages don't add to 100
        // e.g., if total is 110%, each percentage is scaled down proportionally
        if (totalPercentage !== 100 && totalPercentage > 0) {
          pct = (pct / totalPercentage) * 100;
        }

        splits[userId] = Math.round((totalAmount * pct / 100) * 100) / 100;
      });

      // Fix rounding to match total
      const splitSum = Object.values(splits).reduce((a, b) => a + b, 0);
      const diff = Math.round((totalAmount - splitSum) * 100) / 100;
      if (diff !== 0 && participants.length > 0) {
        splits[participants[0]] = Math.round((splits[participants[0]] + diff) * 100) / 100;
      }
      break;
    }

    case 'share': {
      // Ratio-based splitting: if Rohan has 2 shares and Priya has 1,
      // Rohan pays 2/3 and Priya pays 1/3
      let totalShares = 0;
      participants.forEach((userId) => {
        totalShares += parseFloat(splitDetails[userId]) || 1;
      });

      let remaining = totalAmount;
      participants.forEach((userId, index) => {
        const shares = parseFloat(splitDetails[userId]) || 1;
        if (index === participants.length - 1) {
          splits[userId] = Math.round(remaining * 100) / 100;
        } else {
          const amount = Math.round((totalAmount * shares / totalShares) * 100) / 100;
          splits[userId] = amount;
          remaining -= amount;
        }
      });
      break;
    }

    default:
      // If unknown split type, default to equal
      const perPerson = Math.round((totalAmount / participants.length) * 100) / 100;
      participants.forEach((userId) => {
        splits[userId] = perPerson;
      });
  }

  return splits;
}

module.exports = { calculateSplits };
