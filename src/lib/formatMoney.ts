// Agreement and milestone amounts use major currency units (for example, dollars).
export const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
