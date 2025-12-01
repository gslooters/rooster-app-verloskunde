// Railway triggerbestand voor cache-bust
// Elke deployment vereist nieuwe random string in bust value
// DRAAD95C - Database Table Name Fix
module.exports = {
  bust: `1733092800000-${Math.floor(Math.random() * 100000)}` // DRAAD95C - Dec 1, 2025 23:20 CET
};
