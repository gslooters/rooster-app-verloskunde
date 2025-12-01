// Railway triggerbestand voor cache-bust
// Elke deployment vereist nieuwe random string in bust value
// DRAAD95E - Column Name Bugfix rosterid -> roster_id
module.exports = {
  bust: `1733098748000-${Math.floor(Math.random() * 100000)}` // DRAAD95E - Dec 2, 2025 00:19 CET
};
