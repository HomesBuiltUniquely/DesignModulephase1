/** Merge hub category discount fields onto a quote payload (root + data[0]/data). */

export function applyDiscountMetaToLocalPayload(
  snapshotPayload: Record<string, unknown>,
  discountMeta: Record<string, unknown>,
): Record<string, unknown> {
  const nextPayload: Record<string, unknown> = {
    ...snapshotPayload,
    ...discountMeta,
  };
  const data = snapshotPayload.data ?? snapshotPayload.Data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    nextPayload.data = {
      ...(data as Record<string, unknown>),
      ...discountMeta,
    };
  } else if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    nextPayload.data = [
      {
        ...(data[0] as Record<string, unknown>),
        ...discountMeta,
      },
      ...data.slice(1),
    ];
  }
  return nextPayload;
}
