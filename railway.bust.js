// Railway triggerbestand voor cache-bust
// Elke deployment vereist nieuwe random string in bust value
// DRAAD95B - Planning Rules UI Fase 2 implementatie
module.exports = {
  bust: `1733091600000-${Math.floor(Math.random() * 100000)}` // DRAAD95B - Dec 1, 2025 23:00 CET
};
