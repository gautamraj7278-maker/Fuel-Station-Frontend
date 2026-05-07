import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportRowsToCSV(rows, { filename } = {}) {
  if (!rows?.length) return
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename || `export_${todayISO()}.csv`)
}

export function exportRowsToXLSX(rows, { filename, sheetName } = {}) {
  if (!rows?.length) return
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Data')
  XLSX.writeFile(wb, filename || `export_${todayISO()}.xlsx`)
}

export function exportRowsToPDF(rows, { filename, title, orientation } = {}) {
  if (!rows?.length) return
  const doc = new jsPDF({ orientation: orientation || 'landscape' })
  const safeTitle = title || 'Report'
  doc.setFontSize(12)
  doc.text(safeTitle, 14, 14)
  const headers = Object.keys(rows[0])
  const body = rows.map((r) => headers.map((h) => r[h]))
  autoTable(doc, {
    head: [headers],
    body,
    startY: 20,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [25, 118, 210] },
  })
  doc.save(filename || `export_${todayISO()}.pdf`)
}

export function viewRowsAsPDF(rows, { title, orientation } = {}) {
  if (!rows?.length) return
  const doc = new jsPDF({ orientation: orientation || 'landscape' })
  const safeTitle = title || 'Report'
  doc.setFontSize(12)
  doc.text(safeTitle, 14, 14)
  const headers = Object.keys(rows[0])
  const body = rows.map((r) => headers.map((h) => r[h]))
  autoTable(doc, {
    head: [headers],
    body,
    startY: 20,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [25, 118, 210] },
  })

  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  // Open in a new tab only. Never navigate the current page.
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) {
    // Popup blockers can cause window.open to return null; try an anchor click as a fallback.
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  // Revoke after a short delay; the new tab needs time to load the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
