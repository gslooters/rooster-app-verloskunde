// Railway triggerbestand voor cache-bust
// Elke deployment vereist nieuwe random string in bust value
// Fase 2 UI implementatie (verplicht DRAAD95A)
module.exports = {
  bust: `${Date.now()}-${Math.floor(Math.random() * 100000)}`
};
