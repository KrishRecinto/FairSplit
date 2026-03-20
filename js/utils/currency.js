export function formatMoney(amount, currency = '$') {
  return `${currency}${Math.abs(amount).toFixed(2)}`;
}

export function computeSplitAmounts(totalAmount, splits) {
  if (!splits.length) return [];
  const raw = splits.map(s => totalAmount * s.percent / 100);
  const rounded = raw.map(v => Math.floor(v * 100) / 100);
  let remainder = Math.round((totalAmount - rounded.reduce((a, b) => a + b, 0)) * 100);

  const indices = rounded
    .map((_, i) => i)
    .sort((a, b) => (raw[b] - rounded[b]) - (raw[a] - rounded[a]));

  for (let i = 0; i < remainder && i < indices.length; i++) {
    rounded[indices[i]] = Math.round((rounded[indices[i]] + 0.01) * 100) / 100;
  }
  return rounded;
}
