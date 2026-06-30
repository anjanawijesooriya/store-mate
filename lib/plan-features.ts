export type PlanTier = "BASIC" | "STANDARD" | "PREMIUM";

export const PLAN_FEATURES: Record<PlanTier, {
  maxProducts: number;
  customers: boolean;
  expenses: boolean;
}> = {
  BASIC:    { maxProducts: 500, customers: false, expenses: false },
  STANDARD: { maxProducts: Infinity, customers: true,  expenses: true  },
  PREMIUM:  { maxProducts: Infinity, customers: true,  expenses: true  },
};
