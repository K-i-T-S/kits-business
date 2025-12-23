export interface CartLikeItem {
  price: number;
  quantity: number;
}

export interface CalculateTotalOptions {
  taxRate?: number; // e.g. 0.075 for 7.5%
  discount?: number; // flat discount applied after tax
}

export const calculateSubtotal = (items: CartLikeItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

export const calculateTotal = (
  items: CartLikeItem[],
  options: CalculateTotalOptions = {}
): number => {
  const subtotal = calculateSubtotal(items);
  const taxMultiplier = 1 + (options.taxRate ?? 0);
  const gross = subtotal * taxMultiplier;
  return Math.max(0, gross - (options.discount ?? 0));
};
