/**
 * Return the detail rows for a sale/order. New checkouts store several items in
 * `sale.items`; older single-product sales are normalized into one compatible row.
 */
export function getSaleLineItems(sale) {
  if (Array.isArray(sale?.items) && sale.items.length) {
    return sale.items.map((line) => ({
      ...line,
      quantity: Math.max(1, Number(line.quantity || 1)),
      productName: line.productName || 'Product',
    }));
  }

  const quantity = Math.max(1, Number(sale?.quantity || 1));
  const unitPrice = Number(sale?.convertedUnitPrice ?? sale?.saleUnitPrice ?? sale?.originalPrice ?? 0);
  const subtotalAmount = Number(sale?.subtotalAmount ?? unitPrice * quantity);
  const discountAmount = Number(sale?.discountAmount ?? subtotalAmount * Number(sale?.discount || 0) / 100);
  return [{
    id: `${sale?.id || 'sale'}_line_1`,
    productId: sale?.productId || null,
    productName: sale?.productName || 'Product',
    productCategory: sale?.productCategory || '',
    barcode: sale?.barcode || '',
    originalPrice: Number(sale?.originalPrice || 0),
    saleUnitPrice: Number(sale?.saleUnitPrice ?? sale?.originalPrice ?? 0),
    convertedUnitPrice: Number(sale?.convertedUnitPrice ?? unitPrice),
    priceCurrencyCode: sale?.priceCurrencyCode || sale?.currencyCode || sale?.currency || 'UGX',
    currencyCode: sale?.currencyCode || sale?.currency || 'UGX',
    priceExchangeRate: sale?.priceExchangeRate,
    priceExchangeRateTimestamp: sale?.priceExchangeRateTimestamp,
    priceExchangeRateStale: sale?.priceExchangeRateStale === true,
    quantity,
    discount: Number(sale?.discount || 0),
    subtotalAmount,
    discountAmount,
    finalAmount: Number(sale?.finalAmount || 0),
    baseAmount: sale?.baseAmount,
    baseCurrencyCode: sale?.baseCurrencyCode,
    costAtSale: sale?.costAtSale,
    costCurrencyCode: sale?.costCurrencyCode,
    costAtSaleBaseAmount: sale?.costAtSaleBaseAmount,
    exchangeRate: sale?.exchangeRate,
    exchangeRateTimestamp: sale?.exchangeRateTimestamp,
    exchangeRateStale: sale?.exchangeRateStale === true,
  }];
}

export function getSaleItemCount(sale) {
  return getSaleLineItems(sale).reduce((total, line) => total + Math.max(0, Number(line.quantity || 0)), 0);
}

export function getSaleDisplayName(sale) {
  const lines = getSaleLineItems(sale);
  if (lines.length === 1) return lines[0].productName;
  const names = lines.slice(0, 2).map((line) => line.productName);
  return `${names.join(', ')}${lines.length > 2 ? ` +${lines.length - 2} more` : ''}`;
}
