type PurchaseTotal = { completed_at: string; total_spent: number };
const dayNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
export function spendingSeries(trips: PurchaseTotal[], firstPurchase: string | null, dailyBudget: number, now = new Date()) {
  if (!firstPurchase) return null;
  const first = new Date(firstPurchase);
  const start = new Date(Math.max(new Date(now.getFullYear(), 0, 1).getTime(), new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime()));
  const days = Math.max(1, dayNumber(now) - dayNumber(start) + 1);
  const budget = Number.isFinite(dailyBudget) && dailyBudget > 0 ? dailyBudget : 0;
  let spent = 0;
  const points = [{ day: 0, spent: 0 }];
  for (const trip of [...trips].sort((a, b) => a.completed_at.localeCompare(b.completed_at))) {
    const day = dayNumber(new Date(trip.completed_at)) - dayNumber(start) + 1;
    if (day < 1 || day > days) continue;
    // A step shows that spending rises on purchase days, not between trips.
    points.push({ day, spent });
    spent += Math.round(Number(trip.total_spent) * 100);
    points.push({ day, spent });
  }
  points.push({ day: days, spent });
  return { start, days, spent: spent / 100, expected: days * budget,
    points: points.map(p => ({ day: p.day, spent: p.spent / 100 })) };
}
