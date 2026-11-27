import { pdf } from '@react-pdf/renderer';
import { ReportPdfDocument } from './ReportPdfDocument.jsx';

/**
 * Renders the report to a PDF in the browser and hands it to the user as a download. Reached only
 * through a dynamic import on the Download button, so the renderer (several hundred KB) is
 * fetched the first time someone asks for a PDF, never on page load.
 */
export async function exportReportPdf(props, fileName) {
  const blob = await pdf(<ReportPdfDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoked on the next tick: some browsers start the download only after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
