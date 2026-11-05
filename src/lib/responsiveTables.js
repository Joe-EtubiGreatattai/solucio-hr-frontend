// On phones, `.table` rows are shown as stacked cards (see index.css). Each cell needs to know
// its column name for that, so copy the header text onto every body cell as data-label.
// A MutationObserver keeps this working as tables render and update.
function labelTable(table) {
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  if (!heads.length) return;
  for (const row of table.querySelectorAll('tbody tr')) {
    [...row.children].forEach((cell, i) => {
      const label = heads[i] || '';
      if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
    });
  }
}

export function startResponsiveTables() {
  let queued = false;
  const run = () => { queued = false; document.querySelectorAll('table.table').forEach(labelTable); };
  new MutationObserver(() => {
    if (!queued) { queued = true; requestAnimationFrame(run); }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  run();
}
