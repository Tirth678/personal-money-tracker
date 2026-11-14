// Derive cash outflows from database rows without writing duplicate expenses.
// Opening holdings are historical balances, not a new cash outflow.
export function mergeSpending(expenses, investments) {
  return [
    ...expenses,
    ...investments.filter(row => row.kind === 'contribution').map(row => ({
      id: `investment:${row.id}`,
      amount_cents: row.amount_cents,
      category: 'investment',
      note: row.note || 'HDFC fund contribution',
      spent_on: row.invested_on,
      created_at: row.created_at || `${row.invested_on}T00:00:00Z`,
    })),
  ].sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
}
export function spendingTarget(id) {
  return id.startsWith('investment:') ? `/api/investments/${id.slice('investment:'.length)}` : `/api/expenses/${id}`;
}
