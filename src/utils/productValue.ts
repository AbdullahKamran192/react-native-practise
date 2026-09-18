export type ValueGrade = "A" | "B" | "C" | "D" | "E";
export function coverageGrade(percentage: number | null): ValueGrade | null {
 if(percentage === null || !Number.isFinite(percentage) || percentage < 0)return null;
 return percentage >= 100 ? "A" : percentage >= 75 ? "B" : percentage >= 50 ? "C" : percentage >= 25 ? "D" : "E";
}
export function nutritionPerPound(per100: number | null, amount: number, price: number): number | null {
 if(per100 === null || !Number.isFinite(per100) || per100 < 0 ||
 !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(price) || price <= 0)return null;
 const value=per100 * (amount / 100) / price;
 return Number.isFinite(value)?value:null;
}
export function targetCoverage(perPound: number | null, budget: number | null, target: number | null) {
 if(perPound === null || !Number.isFinite(perPound) || perPound < 0 ||
 budget === null || !Number.isFinite(budget) || budget <= 0 ||
 target === null || !Number.isFinite(target) || target <= 0)return null;
 const withinBudget=perPound * budget;
 const percentage=withinBudget / target * 100;
 return Number.isFinite(withinBudget) && Number.isFinite(percentage) ? {withinBudget,percentage,grade:coverageGrade(percentage)!} : null;
}
export function overallCoverage(calories: number | null, protein: number | null): number | null {
 if(coverageGrade(calories) === null || coverageGrade(protein) === null)return null;
 return (Math.min(calories!,100)+Math.min(protein!,100))/2;
}
