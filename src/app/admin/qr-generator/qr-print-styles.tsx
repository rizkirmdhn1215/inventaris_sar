/** Shared print CSS for QR sticker sheets (3×6 = 18 labels per A4 page). */
export function QrPrintStyles({ rootClass = "qr-print-root" }: { rootClass?: string }) {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        body * {
          visibility: hidden !important;
        }
        .${rootClass},
        .${rootClass} * {
          visibility: visible !important;
        }
        .${rootClass} {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
        }
        .qr-print-page {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          grid-template-rows: repeat(6, 1fr) !important;
          gap: 2mm !important;
          width: 194mm !important;
          height: 281mm !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .qr-print-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
        .print-label {
          box-sizing: border-box !important;
          width: 100% !important;
          height: 100% !important;
          max-height: 46mm !important;
          padding: 1.5mm !important;
          border: 0.3mm solid #000 !important;
          border-radius: 2mm !important;
          background: #fff !important;
          color: #000 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .print-label img {
          width: 28mm !important;
          height: 28mm !important;
          object-fit: contain !important;
        }
        .print-label .print-item-name {
          font-size: 8pt !important;
          font-weight: 600 !important;
          margin-top: 1mm !important;
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .print-label .print-qr-code {
          font-size: 7pt !important;
          font-family: monospace !important;
        }
      }
    `}</style>
  );
}
