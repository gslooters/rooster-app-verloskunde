// Railway triggerbestand voor cache-bust
// Elke deployment vereist nieuwe random string in bust value
// DRAAD95D - Rooster-specifieke Planregels UI Implementatie
module.exports = {
  bust: `1733097745000-${Math.floor(Math.random() * 100000)}` // DRAAD95D - Dec 2, 2025 00:02 CET
};
