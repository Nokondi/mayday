export const CATEGORIES = [
  'Food',
  'Housing',
  'Transportation',
  'Healthcare',
  'Legal Aid',
  'Childcare',
  'Education',
  'Employment',
  'Clothing',
  'Household Items',
  'Emotional Support',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];
