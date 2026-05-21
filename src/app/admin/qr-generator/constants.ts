/** Max QR sticker labels per A4 portrait page when printing. */
export const QR_LABELS_PER_PAGE = 18;

export type QrLabelEntry = {
  qrCode: string;
  itemName: string;
};

export function chunkLabels<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}
