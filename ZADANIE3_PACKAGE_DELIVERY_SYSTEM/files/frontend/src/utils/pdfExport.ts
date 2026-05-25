import type { DriverStat, AssignmentItem } from '@/stores/delivery'

const PRIORITY_COLORS: Record<string, [number, number, number]> = {
  Overnight:  [220, 38,  38],
  Expres:     [217, 119, 6],
  Štandard:   [99,  102, 241],
  Ekonomický: [148, 163, 184],
}

export interface RouteStats {
  distance_km: number
  drive_duration_min: number
  est_delivery_min: number
  source: 'osrm' | 'straight' | string
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function estFallback(pkgCount: number): string {
  return fmtMin((pkgCount * 5 + 30))
}

export async function exportDriverPDF(
  driver: DriverStat,
  packages: AssignmentItem[],
  route: RouteStats | null = null,
): Promise<void> {
  // Dynamic imports bypass Vite's CJS interop issues.
  // Import jspdf-autotable as a side-effect — it patches the jsPDF prototype,
  // making doc.autoTable() available without needing the function export.
  const { jsPDF } = await import('jspdf')
  await import('jspdf-autotable')

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const today = new Date().toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Dark header bar ────────────────────────────────────────────────
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, pageW, 30, 'F')

  doc.setTextColor(248, 250, 252)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('KE-Delivery — Route Sheet', 14, 11)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(today, pageW - 14, 11, { align: 'right' })

  doc.setTextColor(203, 213, 225)
  doc.setFontSize(9.5)
  doc.text(`${driver.first_name} ${driver.last_name}  ·  ${driver.driver_id}  ·  ${driver.license_plate}`, 14, 20)
  doc.text(`${driver.vehicle_make_model}  ·  ${driver.vehicle_type}  ·  Zone: ${driver.zone_mestska_cast}`, 14, 27)

  // ── Summary chips ─────────────────────────────────────────────────
  const chipY = 38

  const timeLabel = route
    ? `${fmtMin(route.est_delivery_min)} est.${route.source === 'straight' ? ' (approx)' : ''}`
    : `~${estFallback(packages.length)} est.`

  const distLabel = route ? `${route.distance_km} km` : null

  const streetCount       = packages.filter((p) => p.geocode_status === 'street').length
  const mismatchCount     = packages.filter((p) => p.geocode_status === 'out_of_district').length

  const chips: { label: string; color: [number, number, number] }[] = [
    { label: `${packages.length} packages`,                                                      color: [99,  102, 241] },
    { label: `${driver.assigned_weight_kg.toFixed(1)} / ${driver.max_weight_kg.toFixed(0)} kg`, color: [16, 185, 129] },
    ...(distLabel ? [{ label: distLabel, color: [14, 165, 233] as [number, number, number] }] : []),
    { label: timeLabel,                                                                          color: [245, 158, 11] },
    ...(streetCount   > 0 ? [{ label: `⚠ ${streetCount} street-GPS`,     color: [180, 83,  9]  as [number, number, number] }] : []),
    ...(mismatchCount > 0 ? [{ label: `⚠ ${mismatchCount} wrong district`, color: [185, 28, 28] as [number, number, number] }] : []),
  ]

  let chipX = 14
  for (const chip of chips) {
    const w = doc.getTextWidth(chip.label) + 8
    doc.setFillColor(...chip.color)
    doc.roundedRect(chipX, chipY - 4.5, w, 6.5, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(chip.label, chipX + 4, chipY)
    chipX += w + 5
  }

  // ── Package table ─────────────────────────────────────────────────
  doc.setTextColor(30, 41, 59)

  const codPackages = packages.filter((p) => (p as AssignmentItem & { cod_amount_eur?: number | null }).cod_amount_eur)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).autoTable({
    startY: chipY + 7,
    head: [['#', 'Barcode', 'Recipient', 'Address', 'kg', 'Priority', 'Flags', 'Notes']],
    body: packages.map((p) => {
      const isStreet   = p.geocode_status === 'street'
      const isMismatch = p.geocode_status === 'out_of_district'
      const flags = [p.fragile ? '⚠' : '', isStreet ? '~GPS' : '', isMismatch ? '!DST' : ''].filter(Boolean).join(' ')
      const notes = [
        isStreet   ? '~ Street GPS: find house # on arrival' : '',
        isMismatch ? '! Address outside expected district — verify with recipient' : '',
        p.special_instructions ?? '',
      ].filter(Boolean).join(' | ')
      return [
        p.sequence_number,
        p.barcode,
        p.recipient_name,
        p.address,
        p.weight_kg.toFixed(1),
        p.priority,
        flags,
        notes,
      ]
    }),
    styles:     { fontSize: 7.5, cellPadding: [1.8, 2.5, 1.8, 2.5], textColor: [55, 65, 81] },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252], fontStyle: 'bold', fontSize: 8, cellPadding: [3, 2.5, 3, 2.5] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 23, font: 'courier', fontSize: 7 },
      2: { cellWidth: 30 },
      3: { cellWidth: 55 },
      4: { cellWidth: 11, halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 13, halign: 'center' },
      7: { cellWidth: 'auto' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        const c = PRIORITY_COLORS[data.cell.raw as string]
        if (c) { data.cell.styles.textColor = c; data.cell.styles.fontStyle = 'bold' }
      }
      if (data.section === 'body' && data.column.index === 6) {
        const raw = String(data.cell.raw ?? '')
        if (raw.includes('⚠'))    { data.cell.styles.textColor = [217, 119, 6]; data.cell.styles.fontStyle = 'bold' }
        if (raw.includes('~GPS')) { data.cell.styles.textColor = [180, 83,  9]; data.cell.styles.fontStyle = 'bold' }
        if (raw.includes('!DST')) { data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = 'bold' }
      }
      if (data.section === 'body' && data.column.index === 7) {
        const raw = String(data.cell.raw ?? '')
        if (raw.startsWith('~ Street GPS'))                           { data.cell.styles.textColor = [180, 83,  9] }
        if (raw.startsWith('! Address outside expected district'))    { data.cell.styles.textColor = [185, 28, 28] }
      }
    },
    margin: { left: 14, right: 14 },
  })

  // ── COD summary (if any cash-on-delivery packages) ────────────────
  if (codPackages.length > 0) {
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('Cash on delivery packages:', 14, finalY)
    let codY = finalY + 5
    let codTotal = 0
    for (const p of codPackages) {
      const amt = (p as AssignmentItem & { cod_amount_eur?: number | null }).cod_amount_eur ?? 0
      codTotal += amt
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(`  ${p.barcode}  ${p.recipient_name}  ${amt.toFixed(2)} €`, 14, codY)
      codY += 4
    }
    doc.setFont('helvetica', 'bold')
    doc.text(`  TOTAL COD: ${codTotal.toFixed(2)} €`, 14, codY)
  }

  // ── Footer on every page ──────────────────────────────────────────
  const pageH  = doc.internal.pageSize.getHeight()
  const nPages = doc.getNumberOfPages()
  for (let i = 1; i <= nPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.line(14, pageH - 12, pageW - 14, pageH - 12)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('KE-Delivery s.r.o. — Confidential', 14, pageH - 7)
    doc.text(`Page ${i} / ${nPages}`, pageW - 14, pageH - 7, { align: 'right' })
  }

  doc.save(`route_${driver.driver_id}_${driver.last_name}.pdf`)
}
