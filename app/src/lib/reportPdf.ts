import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatScore, type ReportRow, type ReportSnapshot } from './reportMetrics'

/*
  Renders the Executive AI Visibility Report as a real, text-selectable A4 PDF in the browser.
  Everything comes from the frozen snapshot; nothing is fetched, and no app data is changed.
*/

export type ReportEdition = 'executive' | 'detailed'

const NAVY: [number, number, number] = [15, 27, 45]
const BODY: [number, number, number] = [55, 68, 88]
const MUTED: [number, number, number] = [107, 122, 144]
const TEAL: [number, number, number] = [14, 124, 134]
const BLUE: [number, number, number] = [37, 84, 214]
const RED: [number, number, number] = [176, 42, 55]
const LINE: [number, number, number] = [221, 228, 238]
const SOFT: [number, number, number] = [243, 246, 251]
const M = 15
const W = 210
const H = 297
const CW = W - 2 * M

/** Standard PDF fonts only cover Windows-1252; map anything else to safe text (user/AI text is never interpreted as markup). */
export function pdfSafe(text: string) {
  return text
    .replace(/→/g, '->')
    .replace(/≠/g, '!=')
    .replace(/[✓✔]/g, 'yes')
    .replace(/[✕✗]/g, 'x')
    .replace(/[^\x20-\x7E\xA0-\xFF\n–—‘’“”•…€™]/g, '?')
}

const dateLong = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateTime = (iso: string) => `${dateLong(iso)}, ${time(iso)}`

export function reportFilename(s: ReportSnapshot, edition: ReportEdition) {
  const slug = s.brandName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `ProManage_AI_Visibility_${slug}_${s.auditedAt.slice(0, 10)}_${s.auditId}${s.partialScope ? `_${s.locations.length}-centres` : ''}_${edition === 'detailed' ? 'Detailed' : 'Executive'}.pdf`
}

function outcomeText(r: ReportRow) {
  if (r.category === 'discovery') {
    const seen = r.mentioned ? 'Mentioned' : 'Not mentioned'
    if (r.eligibility === 'eligible') return `${seen} · eligible`
    if (r.eligibility === 'unknown') return `${seen} · relevance not confirmed (excluded)`
    return `${seen} · not relevant to this centre (excluded)`
  }
  if (!r.claims.length) return 'No checkable claim'
  return r.claims
    .map((c) => (c.evaluation === 'match' ? `Matched: ${c.label}` : c.evaluation === 'mismatch' ? `Mismatch: ${c.label} (AI: “${c.value}”; record: “${c.expected ?? '—'}”)` : `Not verifiable: ${c.label} (excluded)`))
    .join('\n')
}

export function renderReportPdf(s: ReportSnapshot, edition: ReportEdition, generatedAt = new Date().toISOString()): { blob: Blob; filename: string; pages: number } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  doc.setProperties({
    title: pdfSafe(`AI Search Visibility Report · ${s.brandName}`),
    subject: pdfSafe(`${s.auditTitle} · ${s.locations.length} centres · ${dateLong(s.auditedAt)} · ${edition === 'detailed' ? 'Detailed report' : 'Executive summary'}`),
    author: 'ProManage Monitor AI (concept prototype)',
    creator: 'ProManage Monitor AI prototype',
    keywords: 'AI visibility, discoverability, information accuracy, simulated',
  })
  const t = (str: string) => pdfSafe(str)
  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color = BODY) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  /** Wrapped paragraph; returns the new y. */
  const para = (str: string, x: number, y: number, width: number, size = 9.5, style: 'normal' | 'bold' | 'italic' = 'normal', color = BODY, lh = 1.38) => {
    font(size, style, color)
    const lines = doc.splitTextToSize(t(str), width) as string[]
    doc.text(lines, x, y, { lineHeightFactor: lh })
    return y + lines.length * size * 0.3528 * lh
  }
  const heading = (str: string, y: number, size = 12.5) => {
    font(size, 'bold', NAVY)
    doc.text(t(str), M, y)
    return y + 5.5
  }
  const ensure = (y: number, need: number) => {
    if (y + need > H - 22) {
      doc.addPage()
      return 20
    }
    return y
  }
  const region = [...new Set(s.locations.map((l) => l.city))].join(', ')

  /* ───────── Page 1 · Executive summary ───────── */
  font(9, 'bold', TEAL)
  doc.text('ProManage Monitor AI', M, 14)
  font(8.5, 'normal', MUTED)
  doc.text(t(`${s.brandName} · Generated ${dateTime(generatedAt)}`), W - M, 14, { align: 'right' })
  doc.setDrawColor(...LINE)
  doc.line(M, 17, W - M, 17)
  font(21, 'bold', NAVY)
  doc.text('AI Search Visibility Report', M, 29)
  let y = para(`${s.brandName} · ${s.auditTitle} · ${region} · ${dateLong(s.auditedAt)}`, M, 36, CW, 10.5, 'normal', BODY)
  if (s.simulated) {
    doc.setFillColor(255, 244, 222)
    doc.roundedRect(M, y - 2.5, 64, 6, 1.2, 1.2, 'F')
    font(8, 'bold', [154, 98, 0])
    doc.text('Concept prototype · simulated results', M + 2.5, y + 1.6)
    y += 7
  }
  if (s.partialScope) y = para(`Scope: ${s.locations.length} of the centres in this check. All figures below are recalculated for these centres only.`, M, y + 1, CW, 8.5, 'italic', MUTED)

  // Scope strip
  y += 2
  const strip: [string, string][] = [
    ['Centres assessed', `${s.locations.length} of ${s.totalLocations}`],
    ['Questions tested', `${s.questionTemplates.length} per centre`],
    ['Sampled answers', `${s.sampledAnswers}`],
    ['AI surface', s.surfaceLabel],
    ['Sampling window', s.samplingWindow ? `${dateLong(s.samplingWindow.from)}, ${time(s.samplingWindow.from)}–${time(s.samplingWindow.to)}` : 'Not available'],
  ]
  const bw = CW / strip.length
  strip.forEach(([k, v], i) => {
    const x = M + i * bw
    doc.setFillColor(...SOFT)
    doc.rect(x + (i ? 1 : 0), y, bw - (i ? 1 : 0), 15, 'F')
    font(7.5, 'normal', MUTED)
    doc.text(t(k.toUpperCase()), x + 3, y + 5)
    font(9, 'bold', NAVY)
    doc.text(doc.splitTextToSize(t(v), bw - 5) as string[], x + 3, y + 10)
  })
  y += 22

  y = heading('What we checked', y)
  y = para(`We sampled one AI answer to each selected parent question for the ${s.locations.length} centres listed in this report (${s.sampledAnswers} answers in total). Discoverability looks at general questions where a centre could be recommended; Information accuracy checks facts AI states about each centre against the verified business record. These results describe the sampled answers, not all searches on AI platforms.`, M, y, CW) + 4

  // Score cards
  const cardW = (CW - 6) / 2
  const card = (x: number, title: string, colour: [number, number, number], big: string, lines: string[]) => {
    doc.setDrawColor(...LINE)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, cardW, 58, 2, 2, 'FD')
    font(8, 'bold', colour)
    doc.text(t(title.toUpperCase()), x + 5, y + 7)
    font(26, 'bold', NAVY)
    doc.text(t(big), x + 5, y + 19)
    let yy = y + 26
    lines.forEach((l, i) => {
      yy = para(l, x + 5, yy, cardW - 10, i === 0 ? 9 : 8.2, i === 0 ? 'bold' : 'normal', i === 0 ? NAVY : BODY, 1.3) + 1.2
    })
  }
  const dc = s.discoveryCounts
  card(M, 'Discoverability · eligible mention rate', TEAL, formatScore(s.discovery), [
    s.discovery.denominator ? `${s.discovery.numerator} of ${s.discovery.denominator} eligible unbranded sampled answers mentioned the relevant BrightNest centre.` : 'No eligible unbranded sampled answers in this scope.',
    `${dc.eligibleNotMentioned} eligible answer${dc.eligibleNotMentioned === 1 ? '' : 's'} did not mention it.`,
    `Excluded from the rate: ${dc.relevanceNotConfirmed} with relevance not confirmed and ${dc.notRelevant} not relevant to the centre (of ${dc.unbrandedAnswers} unbranded answers).`,
  ])
  const ac = s.accuracyStatusCounts
  const fc = s.flaggedCounts
  card(M + cardW + 6, 'Information accuracy · verified fact match rate', BLUE, formatScore(s.accuracy), [
    s.accuracy.denominator ? `${s.accuracy.numerator} of ${s.accuracy.denominator} checkable claims matched the verified business record.` : 'Not enough verified claims to score.',
    `${ac.conflicting} claim${ac.conflicting === 1 ? '' : 's'} conflicted with the record. ${ac.unverifiable} could not be verified and are excluded, not counted as wrong.`,
    `Separately, ${fc.total} answer${fc.total === 1 ? ' was' : 's were'} flagged for review: ${fc.confirmed} confirmed error${fc.confirmed === 1 ? '' : 's'}, ${fc.verify} need business verification${fc.confusion ? `, ${fc.confusion} possible mix-up` : ''}${fc.review ? `, ${fc.review} need review` : ''}.`,
  ])
  y += 64

  y = heading('What needs attention', y)
  for (const f of s.keyFindings) {
    const tag = f.kind === 'discovery' ? 'DISCOVERABILITY' : 'ACCURACY'
    const colour = f.kind === 'discovery' ? TEAL : RED
    font(7.5, 'bold', colour)
    doc.text(tag, M, y)
    const top = para(`${f.locationName} · “${f.question}”`, M + 30, y, CW - 30, 9, 'bold', NAVY, 1.3)
    y = para(f.text, M + 30, top + 0.5, CW - 30, 8.6, 'normal', BODY, 1.3) + 3
  }
  if (!s.keyFindings.length) y = para('No discovery gaps or confirmed factual conflicts were found in this scope.', M, y, CW) + 3

  y = heading('What this means', y + 1)
  y = para('These results show where to look first: location content and listing completeness for the discovery gaps, and conflicting business facts to verify and correct. A missing mention is an opportunity to investigate, not proof of a lost customer. ProManage can investigate the sources it manages and prepare Brand-approved improvements (Improve, V1).', M, y, CW) + 2
  para(`Method: ${s.discovery.methodologyLabel}. ${s.accuracy.methodologyLabel}. ${s.disclaimer}`, M, y, CW, 7.6, 'italic', MUTED, 1.3)

  /* ───────── Page 2 · Location scorecard and questions ───────── */
  doc.addPage()
  y = heading('Where performance differs by location', 20, 15) + 1
  y = para('All centres in this report, in audit order. Mention rate = mentioned ÷ eligible discovery samples. Accuracy columns count claims checked against the verified record; unverified claims are excluded, not counted as wrong. “—” means no denominator.', M, y, CW, 8.3, 'normal', MUTED, 1.3) + 1
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 20, bottom: 22 },
    head: [['Centre', 'Eligible samples', 'Mentioned', 'Mention rate', 'Verified claims', 'Correct', 'Mismatch', 'Unverified', 'Main observation']],
    body: s.locationScores.map((l) => [t(l.name.replace(/^BrightNest Preschool – |^BrightNest /, '')), String(l.eligible), String(l.mentioned), l.discovery.percentage === null ? '—' : `${Math.round(l.discovery.percentage)}%`, String(l.accuracy.denominator), String(l.correct), String(l.mismatch), String(l.unverified), t(l.observation)]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.3, textColor: BODY, lineColor: LINE, lineWidth: 0.1, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2 },
    alternateRowStyles: { fillColor: [249, 251, 253] },
    columnStyles: { 0: { cellWidth: 24, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 13, halign: 'center' }, 4: { cellWidth: 13, halign: 'center' }, 5: { cellWidth: 12, halign: 'center' }, 6: { cellWidth: 14, halign: 'center' }, 7: { cellWidth: 15, halign: 'center' }, 8: { cellWidth: 'auto' } },
    foot: [['All centres', String(s.discovery.denominator), String(s.discovery.numerator), formatScore(s.discovery).replace('Not enough verified data', '—'), String(s.accuracy.denominator), String(ac.matching), String(ac.conflicting), String(ac.unverifiable), `Mention rate ${formatScore(s.discovery)} · verified fact match rate ${formatScore(s.accuracy)}`]],
    footStyles: { fillColor: SOFT, textColor: NAVY, fontStyle: 'bold', fontSize: 7.8 },
    showFoot: 'lastPage',
  })
  y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 7

  y = ensure(y, 45)
  y = heading('Questions checked', y)
  const disc = s.questionTemplates.filter((q) => q.category === 'discovery')
  const fact = s.questionTemplates.filter((q) => q.category === 'factual')
  const colW = (CW - 6) / 2
  const listCol = (x: number, title: string, items: typeof disc, startY: number) => {
    font(8.5, 'bold', NAVY)
    doc.text(t(title), x, startY)
    let yy = startY + 4.5
    items.forEach((q) => {
      yy = para(`• ${q.template}${q.template.endsWith('?') ? '' : '?'}`, x, yy, colW, 8.3, 'normal', BODY, 1.22) + 0.4
    })
    return yy
  }
  const y1 = listCol(M, `Unbranded discovery (${disc.length}) · could a centre be recommended?`, disc, y)
  const y2 = listCol(M + colW + 6, `Branded factual (${fact.length}) · is information about the centre correct?`, fact, y)
  y = Math.max(y1, y2) + 1
  const sample = s.keyFindings.find((k) => k.kind === 'discovery')?.question ?? s.rows[0]?.question
  if (sample) y = para(`Each question is asked for every centre with its own area filled in, e.g. “${sample}”. ${edition === 'detailed' ? 'Every exact question and answer is listed in Appendix B.' : 'Full questions and answers are included in the detailed edition.'}`, M, y, CW, 8.3, 'italic', MUTED, 1.3) + 4

  y = ensure(y, 30)
  y = heading('Recommended areas for follow-up', y)
  for (const a of s.followUpAreas) y = para(`• ${a}`, M, y, CW, 8.6, 'normal', BODY, 1.27) + 0.6
  if (!s.followUpAreas.length) y = para('No follow-up areas are indicated for this scope.', M, y, CW, 8.8) + 1
  y += 3

  y = ensure(y, 26)
  doc.setFillColor(238, 244, 255)
  doc.setDrawColor(201, 214, 245)
  const boxText = doc.splitTextToSize(t('ProManage can investigate the information sources it manages for your centres and prepare Brand-approved content, listing and structured-data improvements, then help you run a matched follow-up check. Learn about Improve (V1) in ProManage Monitor AI.'), CW - 10) as string[]
  const boxH = 10 + boxText.length * 4
  doc.roundedRect(M, y, CW, boxH, 2, 2, 'FD')
  font(9.5, 'bold', NAVY)
  doc.text('Want to act on these findings?', M + 5, y + 6)
  font(8.6, 'normal', BODY)
  doc.text(boxText, M + 5, y + 11, { lineHeightFactor: 1.3 })
  y += boxH + 5
  y = ensure(y, 12)
  para('A missing mention is not an AI error, and a sample is not all searches. Findings don’t prove why an AI answered as it did, and no change can guarantee future recommendations or rankings.', M, y, CW, 7.6, 'italic', MUTED, 1.3)

  /* ───────── Detailed edition · appendices ───────── */
  if (edition === 'detailed') {
    doc.addPage()
    y = heading('Appendix A · Audited scope', 20, 14) + 1
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 20, bottom: 22 },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.5, textColor: BODY, overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold', textColor: NAVY } },
      body: [
        ['Brand', t(s.brandName)],
        ['Audit', t(`${s.auditTitle} · ID ${s.auditId}`)],
        ['Run', t(dateTime(s.auditedAt))],
        ['AI surface', t(`${s.surfaceLabel}${s.simulated ? ' · simulated answers' : ''}`)],
        ['Sampling policy', 'One sampled answer per question per centre (baseline check only; later follow-up checks are not included).'],
        ['Sampling window', s.samplingWindow ? t(`${dateTime(s.samplingWindow.from)} to ${dateTime(s.samplingWindow.to)}`) : 'Not available'],
        ['Centres', t(s.locations.map((l) => `${l.name} (${l.id}, ${l.city})`).join('\n'))],
        ['Question templates', t(s.questionTemplates.map((q) => `${q.id} · ${q.category === 'discovery' ? 'Unbranded discovery' : 'Branded factual'} · ${q.template}`).join('\n'))],
      ],
    })
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 8
    y = ensure(y, 40)
    y = heading('Appendix B · Question-level observations and original AI answers', y, 12.5)
    y = para(`${s.rows.length} location × question samples. Original answers are reproduced in full with their wording unchanged (only Markdown formatting characters are removed). Sources are listed only when the sampled answer cited them.`, M, y, CW, 8.3, 'normal', MUTED, 1.3) + 1
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 20, bottom: 22 },
      head: [['#', 'Centre', 'Question', 'Type', 'Outcome', 'Sampled', 'Original AI answer and sources']],
      body: s.rows.map((r, i) => [
        String(i + 1),
        t(s.locations.find((l) => l.id === r.locationId)?.neighborhood ?? r.locationId),
        t(`${r.question}${r.question.endsWith('?') ? '' : '?'}`),
        r.category === 'discovery' ? 'Unbranded discovery' : 'Branded factual',
        t(outcomeText(r)),
        t(dateTime(r.sampledAt)),
        t(`${r.answer.replace(/\*\*(.+?)\*\*/g, '$1')}\n\n${r.citations.length ? `Sources: ${r.citations.map((c) => `${c.title} (${c.url})`).join('; ')}` : 'No cited source available in sampled answer.'}`),
      ]),
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.4, textColor: BODY, lineColor: LINE, lineWidth: 0.1, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 18, fontStyle: 'bold', textColor: NAVY }, 2: { cellWidth: 30 }, 3: { cellWidth: 16 }, 4: { cellWidth: 28 }, 5: { cellWidth: 17 }, 6: { cellWidth: 'auto' } },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
    })
    doc.addPage()
    y = heading('Appendix C · Methodology and limitations', 20, 14) + 2
    const method: [string, string][] = [
      ['Sampling', `${s.surfaceLabel}. One answer was sampled per question per centre between ${s.samplingWindow ? `${dateTime(s.samplingWindow.from)} and ${dateTime(s.samplingWindow.to)}` : 'the audit dates'}. AI answers vary between runs; a sample is not all searches.`],
      ['Questions and centres', 'ProManage suggested representative parent questions in two groups: unbranded discovery questions (could a centre be recommended?) and branded factual questions (are stated facts correct?). They represent tested intents, not claims about how often parents ask them.'],
      ['Eligibility', 'A discovery question counts for a centre only when the verified business record shows the centre offers what was asked. Questions whose relevance isn’t confirmed, or that don’t fit the centre, are excluded from the mention rate and disclosed separately.'],
      ['Entity matching', 'A centre counts as mentioned only when that specific centre is named. A different BrightNest centre being named does not count for this one.'],
      ['Verification', 'Facts stated in branded answers are extracted as claims and compared with the verified business record. Claims without a verified record, or too vague to check, are excluded from the accuracy rate, not counted as wrong.'],
      ['Scores', `Discoverability = ${s.discovery.methodologyLabel.toLowerCase()}. Information accuracy = ${s.accuracy.methodologyLabel.toLowerCase()}. Rates are not averages of per-centre percentages.`],
      ['Units', `Sampled answers (${s.sampledAnswers}), extracted claims (${ac.totalClaims}) and flagged answers (${fc.total}) are different units and don’t add up to each other.`],
      ['Limitations', 'A missing mention is a discovery opportunity, not proof of an AI error or a lost customer. Findings don’t prove why an AI answered as it did. No change can guarantee future recommendations, rankings or business outcomes.'],
      ['This prototype', s.disclaimer],
    ]
    for (const [k, v] of method) {
      y = ensure(y, 16)
      font(9.5, 'bold', NAVY)
      doc.text(t(k), M, y)
      y = para(v, M, y + 4.5, CW, 9, 'normal', BODY, 1.35) + 3
    }
  }

  /* ───────── Footer on every page ───────── */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE)
    doc.line(M, H - 16, W - M, H - 16)
    font(7.4, 'normal', MUTED)
    doc.text(t(`Confidential · prepared for ${s.brandName}${s.simulated ? ' · Simulated prototype' : ''} · Report ${s.reportVersion} · ${s.auditId}`), M, H - 11.5)
    doc.text(`Page ${p} of ${pages}`, W - M, H - 11.5, { align: 'right' })
    doc.text('Sampled AI answers, not all searches. No guarantee of ranking, and findings do not prove cause.', M, H - 8)
  }
  const blob = doc.output('blob')
  return { blob, filename: reportFilename(s, edition), pages }
}
