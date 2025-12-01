// Railway triggerbestand voor cache-bust
// Elke deployment vereist nieuwe random string in bust value
// DRAAD95F - Vereenvoudigde Planregels UI Toggle-Only Interface
module.exports = {
  bust: `${Date.now()}-${Math.floor(Math.random() * 100000)}` // DRAAD95F - Dec 2, 2025 00:55 CET
};
