import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Renders a DOM node to a single-page A4 PDF and returns both the jsPDF
 * instance and a base64 (no data-url prefix) payload for emailing.
 */
export async function renderNodeToPdf(
  node: HTMLElement,
  fileName: string,
): Promise<{ pdf: jsPDF; base64: string }> {
  const canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: '#0b0d10',
    useCORS: true,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  const base64 = pdf.output('datauristring').split(',')[1]
  pdf.setProperties({ title: fileName })

  return { pdf, base64 }
}

export function downloadPdf(pdf: jsPDF, fileName: string): void {
  pdf.save(fileName)
}
