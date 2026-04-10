const categoryColors: Record<string, string> = {
  'Food': 'bg-green-100 text-green-800',
  'Housing': 'bg-blue-100 text-blue-800',
  'Transportation': 'bg-yellow-100 text-yellow-800',
  'Healthcare': 'bg-red-100 text-red-800',
  'Legal Aid': 'bg-purple-100 text-purple-800',
  'Childcare': 'bg-pink-100 text-pink-800',
  'Education': 'bg-indigo-100 text-indigo-800',
  'Employment': 'bg-teal-100 text-teal-800',
  'Clothing': 'bg-orange-100 text-orange-800',
  'Household Items': 'bg-amber-100 text-amber-800',
  'Emotional Support': 'bg-rose-100 text-rose-800',
  'Other': 'bg-gray-100 text-gray-800',
};

export function CategoryBadge({ category }: { category: string }) {
  const color = categoryColors[category] || categoryColors['Other'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {category}
    </span>
  );
}
