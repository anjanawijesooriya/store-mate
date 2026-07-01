export type PlanTier = "BASIC" | "STANDARD" | "PREMIUM";

export const PLAN_FEATURES: Record<PlanTier, {
  maxProducts: number;
  customers: boolean;
  expenses: boolean;
  offlinePOS: boolean;
  advancedAnalytics: boolean;
}> = {
  BASIC:    { maxProducts: 500,      customers: false, expenses: false, offlinePOS: false, advancedAnalytics: false },
  STANDARD: { maxProducts: Infinity, customers: true,  expenses: true,  offlinePOS: true,  advancedAnalytics: false },
  PREMIUM:  { maxProducts: Infinity, customers: true,  expenses: true,  offlinePOS: true,  advancedAnalytics: true  },
};
