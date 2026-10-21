import type { Audit, Citation, ExtractedClaim, FieldKey, Location, Observation, PromptTemplate, SurfaceId } from './types'
import { COMPETITORS, FIELD_LABELS, fillPrompt } from './seed'
import { hashString, seeded, shuffle } from '@/lib/random'

/*
  Deterministic answer simulator. Every response is generated from
  (location, prompt, wave) so the same scope always yields the same sample.
  Claims are *evaluated by rule* against the verified record — mismatches are
  never hard-coded as such.
*/

type Pair = [string, string]

/** Wave-0 discovery mentions for the 10 pilot centers × default discovery prompts p1–p5. */
const BASELINE_MENTIONS: Record<string, number[]> = {
  whitefield: [1, 0, 1, 1, 0],
  'hsr-layout': [1, 1, 0, 1, 1],
  koramangala: [1, 1, 1, 0, 1],
  indiranagar: [0, 0, 1, 1, 0],
  sarjapur: [1, 0, 0, 0, 0],
  jayanagar: [0, 1, 0, 1, 0],
  bellandur: [0, 0, 0, 0, 0],
  brookefield: [0, 0, 1, 0, 0],
  'electronic-city': [0, 0, 0, 0, 1],
  marathahalli: [0, 0, 0, 0, 0],
}

/** Mentions that flip between consecutive simulated rechecks (fluctuation in both directions). */
const WAVE_FLIPS: Record<number, Pair[]> = {
  1: [['whitefield', 'p2'], ['whitefield', 'p5'], ['marathahalli', 'p1'], ['brookefield', 'p4'], ['sarjapur', 'p1'], ['electronic-city', 'p5']],
  2: [['bellandur', 'p3'], ['indiranagar', 'p1'], ['jayanagar', 'p2']],
}

function baselineMention(locId: string, promptId: string): boolean {
  const row = BASELINE_MENTIONS[locId]
  const idx = ['p1', 'p2', 'p3', 'p4', 'p5'].indexOf(promptId)
  if (row && idx >= 0) return row[idx] === 1
  return hashString(`mention:${locId}:${promptId}`) % 100 < 34
}

/** Discovery answers that name a different BrightNest branch instead (brand-level mention only). */
const BRAND_ONLY: Record<string, string> = {
  'marathahalli:p1': 'Brookefield',
  'bellandur:p3': 'HSR Layout',
  'sarjapur:p2': 'HSR Layout',
  'brookefield:p1': 'Whitefield',
  'indiranagar:p5': 'Koramangala',
}

export function isMentioned(locId: string, promptId: string, wave: number, surface: SurfaceId = 'A'): boolean {
  if (surface === 'B') {
    // Conceptual second surface: its own deterministic sample, never merged with A.
    let m = baselineMention(locId, promptId) !== (hashString(`B:${locId}:${promptId}`) % 4 === 0)
    for (let w = 1; w <= wave; w++) if (hashString(`flipB:${locId}:${promptId}:${w}`) % 9 === 0) m = !m
    return m
  }
  let m = baselineMention(locId, promptId)
  for (let w = 1; w <= wave; w++) {
    const flips = WAVE_FLIPS[w]
    if (flips) {
      if (flips.some(([l, p]) => l === locId && p === promptId)) m = !m
    } else if (hashString(`flip:${locId}:${promptId}:${w}`) % 13 === 0) {
      m = !m
    }
  }
  return m
}

const norm = (s: string) => s.toLowerCase().replace(/[–—-]/g, '-').replace(/\s+/g, ' ').trim()

function claim(loc: Location, id: string, field: FieldKey | 'other', span: string, value = span, sensitive = false): ExtractedClaim {
  if (field === 'other') {
    return { id, field, label: 'Other claim', span, value, evaluation: 'unverifiable', expected: null, sensitive }
  }
  const record = loc.verifiedFields[field]
  if (record.status !== 'verified' || !record.value) {
    return { id, field, label: FIELD_LABELS[field], span, value, evaluation: 'cannot_evaluate', expected: null, sensitive }
  }
  return {
    id,
    field,
    label: FIELD_LABELS[field],
    span,
    value,
    evaluation: norm(record.value) === norm(value) ? 'match' : 'mismatch',
    expected: record.value,
    sensitive,
  }
}

const DISCOVERY_INTRO: Record<string, string> = {
  p1: 'Here are some well-regarded preschools near {n}, {c} that parents often shortlist:',
  p2: 'Several preschools near {n} offer weekend visits. A few options to consider:',
  p3: 'If you need daycare or extended hours near {n}, these centers are often mentioned:',
  p4: 'Preschools near {n} that tend to receive positive parent feedback include:',
  p5: 'For play-based or Montessori-style programs in {n}, you could look at:',
  p9: 'For toddlers around two years old near {n}, these playgroups are commonly suggested:',
}

const COMPETITOR_NOTES: Record<string, string[]> = {
  p1: ['structured early-years curriculum with small class sizes', 'large outdoor play area and a reading corner', 'phonics-led Nursery and KG programs'],
  p2: ['open house on select Saturdays; booking recommended', 'weekend tours during admission season', 'virtual tours on request'],
  p3: ['daycare until early evening on weekdays', 'half-day and full-day options', 'after-school care for older siblings'],
  p4: ['parents often mention approachable teachers', 'regular parent–teacher updates', 'well-reviewed settling-in process'],
  p5: ['Montessori-inspired classrooms', 'mixed-age learning groups', 'sensory and practical-life activities'],
  default: ['popular with families in the area', 'play-based early-years program', 'flexible admission dates'],
}

interface Built {
  text: string
  claims: ExtractedClaim[]
  citations: Citation[]
  mentioned: boolean
  mentionedBrand?: boolean
  otherBranchName?: string
  position?: number
}

function brightnestDiscoveryNote(loc: Location, promptId: string, wave: number): { note: string; claims: ExtractedClaim[] } {
  const cid = (k: string) => `${loc.id}-${promptId}-w${wave}-${k}`
  const sat = loc.verifiedFields.saturdayTours
  switch (promptId) {
    case 'p2':
      if (sat.value && !sat.value.startsWith('No ')) {
        return { note: `offers ${sat.value}`, claims: [claim(loc, cid('sat'), 'saturdayTours', sat.value)] }
      }
      return { note: 'weekday campus visits with a play-based program', claims: [] }
    case 'p3': {
      const hours = 'Mon–Fri 8:30 AM–6:30 PM'
      return { note: `daycare available ${hours}`, claims: [claim(loc, cid('hours'), 'hours', hours)] }
    }
    case 'p4':
      if (loc.id === 'indiranagar') {
        return {
          note: 'known for its in-house pediatrician and caring staff',
          claims: [claim(loc, cid('pediatrician'), 'other', 'in-house pediatrician', 'in-house pediatrician', true)],
        }
      }
      return { note: 'parents frequently mention its communication updates and caring staff', claims: [] }
    case 'p5':
      return { note: 'play-based learning with Montessori materials in the Nursery and LKG years', claims: [] }
    default:
      return { note: 'play-based curriculum from Playgroup to UKG with an on-site daycare', claims: [] }
  }
}

function buildDiscovery(loc: Location, prompt: PromptTemplate, wave: number, surface: SurfaceId): Built {
  const rand = seeded(`disc:${surface}:${loc.id}:${prompt.id}`)
  const mentioned = isMentioned(loc.id, prompt.id, wave, surface)
  const competitors = shuffle(rand, COMPETITORS).slice(0, mentioned ? 3 : 4)
  const notes = COMPETITOR_NOTES[prompt.id] ?? COMPETITOR_NOTES.default
  const intro = (DISCOVERY_INTRO[prompt.id] ?? 'Here are some options for “{q}”:')
    .replace('{n}', loc.neighborhood)
    .replace('{c}', loc.city)
    .replace('{q}', fillPrompt(prompt.text, loc))

  const items = competitors.map((name, i) => `**${name}** — ${notes[i % notes.length]}.`)
  let claims: ExtractedClaim[] = []
  let position: number | undefined
  if (mentioned) {
    const b = brightnestDiscoveryNote(loc, prompt.id, wave)
    claims = b.claims
    position = (hashString(`pos:${loc.id}:${prompt.id}:${wave}`) % 3) + 1
    items.splice(position - 1, 0, `**BrightNest Preschool – ${loc.neighborhood}** — ${b.note}.`)
  }
  const other = !mentioned && surface === 'A' ? BRAND_ONLY[`${loc.id}:${prompt.id}`] : undefined
  if (other) items.splice(1, 0, `**BrightNest Preschool – ${other}** — play-based Playgroup to UKG program, a short drive away.`)

  const citations: Citation[] = []
  if (hashString(`cite:${loc.id}:${prompt.id}`) % 3 === 0) {
    citations.push({ title: `Parents Circle — preschools in ${loc.neighborhood}`, url: `https://parents-circle.example/${loc.id}/preschools` })
  }

  const text = [
    intro,
    '',
    ...items.map((it, i) => `${i + 1}. ${it}`),
    '',
    'Availability and timings can change — confirm directly with each school before visiting.',
  ].join('\n')

  return { text, claims, citations, mentioned, position, mentionedBrand: mentioned || !!other, otherBranchName: other ? `BrightNest Preschool – ${other}` : undefined }
}

function buildBranded(loc: Location, prompt: PromptTemplate, wave: number): Built {
  const f = loc.verifiedFields
  const name = `BrightNest Preschool – ${loc.neighborhood}`
  const cid = (k: string) => `${loc.id}-${prompt.id}-w${wave}-${k}`
  const key = `${loc.id}:${prompt.id}`
  const out = (text: string, claims: ExtractedClaim[], citations: Citation[] = []): Built => ({ text, claims, citations, mentioned: true })

  // Hand-authored cases for the pilot story. Values are still evaluated by rule.
  switch (key) {
    case 'whitefield:p6':
      if (wave === 0) {
        const span = 'no Saturday tours'
        return out(
          `Based on the listings I found, ${name} appears to offer ${span}; campus visits seem to be by weekday appointment only. You may want to call ahead to confirm.`,
          [claim(loc, cid('sat'), 'saturdayTours', span, 'No Saturday tours')],
          [{ title: 'Bengaluru Preschool Directory — Whitefield listings (2024 snapshot)', url: 'https://bengaluru-preschool-directory.example/whitefield' }],
        )
      }
      return out(
        `Yes. ${name} lists Saturday tours 10 AM–1 PM. Booking a slot through the center's website is recommended.`,
        [claim(loc, cid('sat'), 'saturdayTours', 'Saturday tours 10 AM–1 PM')],
        [{ title: 'BrightNest — Whitefield center page', url: 'https://brightnest.example/centers/whitefield' }],
      )
    case 'hsr-layout:p7': {
      const hours = wave >= 1 ? 'Mon–Fri 8:30 AM–6:30 PM' : 'Mon–Sat 9 AM–6 PM'
      return out(`You can reach ${name} at ${f.phone.value}. The center is typically open ${hours}.`, [
        claim(loc, cid('phone'), 'phone', f.phone.value!),
        claim(loc, cid('hours'), 'hours', hours),
      ])
    }
    case 'indiranagar:p7':
      return out(
        `The listed contact number for ${name} is +91 80 4000 9911. Opening hours are usually Mon–Fri 8:30 AM–6:30 PM.`,
        [claim(loc, cid('phone'), 'phone', '+91 80 4000 9911'), claim(loc, cid('hours'), 'hours', 'Mon–Fri 8:30 AM–6:30 PM')],
        [{ title: 'CityKids Directory — Indiranagar', url: 'https://citykids-directory.example/blr/indiranagar' }],
      )
    case 'jayanagar:p7':
      if (wave === 0) {
        return out(`${name} can be reached at ${f.phone.value}. It is open Mon–Fri 8:30 AM–5 PM.`, [
          claim(loc, cid('phone'), 'phone', f.phone.value!),
          claim(loc, cid('hours'), 'hours', 'Mon–Fri 8:30 AM–5 PM'),
        ])
      }
      break
    case 'brookefield:p8':
      if (wave === 0) {
        const span = 'ITPL Main Road, Whitefield, Bengaluru 560066'
        return out(`${name} is located on ${span}, close to the tech park. Some listings place it near the Brookefield junction.`, [
          claim(loc, cid('addr'), 'address', span),
        ])
      }
      if (wave === 1) {
        return out(`${name} is in the Brookefield area of east Bengaluru. I couldn't confirm a precise street address from the sources available.`, [])
      }
      break
    case 'sarjapur:p6':
      return out(
        `${name} schedules campus visits on weekdays. One parent forum mentions that the center provides free transport for Saturday visits, but this isn't listed on its website.`,
        [claim(loc, cid('transport'), 'other', 'free transport for Saturday visits')],
        [{ title: 'Sarjapur Parents Forum thread', url: 'https://sarjapur-parents.example/threads/preschool-visits' }],
      )
    case 'bellandur:p6':
      return out(`${name} appears to hold Saturday tours on the first Saturday of each month, based on a social media post.`, [
        claim(loc, cid('sat'), 'saturdayTours', 'Saturday tours on the first Saturday of each month'),
      ])
    case 'bellandur:p7':
      return out(`You can contact ${name} at +91 80 4000 1107. It's typically open Mon–Fri 8:30 AM–6:30 PM.`, [
        claim(loc, cid('phone'), 'phone', '+91 80 4000 1107'),
        claim(loc, cid('hours'), 'hours', 'Mon–Fri 8:30 AM–6:30 PM'),
      ])
    case 'electronic-city:p7':
      return out(`${name} can be reached at ${f.phone.value}. Listed hours are Mon–Fri 9 AM–5 PM.`, [
        claim(loc, cid('phone'), 'phone', f.phone.value!),
        claim(loc, cid('hours'), 'hours', 'Mon–Fri 9 AM–5 PM'),
      ])
    case 'marathahalli:p8':
      if (wave >= 2) {
        return out(`${name} is open and located at ${f.address.value}. Admissions for the next term are listed on its center page.`, [
          claim(loc, cid('status'), 'operatingStatus', 'Open'),
          claim(loc, cid('addr'), 'address', f.address.value!),
        ])
      }
      return out(
        `${name} was located at ${f.address.value}, but it appears to be permanently closed according to some listings. You may want to consider other preschools nearby.`,
        [claim(loc, cid('addr'), 'address', f.address.value!), claim(loc, cid('status'), 'operatingStatus', 'permanently closed', 'Permanently closed')],
        [{ title: 'LocalSchools Index — Marathahalli', url: 'https://localschools-index.example/bengaluru/marathahalli' }],
      )
    case 'marathahalli:p6':
      return out(
        `I couldn't find reliable information about Saturday visits at ${name}. Contacting the center directly or checking its official website is the best way to confirm.`,
        [],
      )
  }

  // Generic branded answers derived from the record (or a plausible guess when the record is unverified).
  switch (prompt.id) {
    case 'p6': {
      const sat = f.saturdayTours.value ?? 'Saturday tours by appointment'
      if (sat.startsWith('No ')) {
        return out(`Based on available information, ${name} schedules campus visits on weekdays. ${sat} are listed for this center.`, [
          claim(loc, cid('sat'), 'saturdayTours', sat.replace(' (weekday visits only)', ''), sat),
        ])
      }
      return out(`Yes. ${name} lists ${sat}. Parents are advised to book through the center's website.`, [claim(loc, cid('sat'), 'saturdayTours', sat)])
    }
    case 'p7': {
      const phone = f.phone.value ?? `+91 80 4000 ${hashString(loc.id) % 9000 + 1000}`
      const hours = f.hours.value ?? 'Mon–Fri 9 AM–5 PM'
      return out(`You can reach ${name} at ${phone}. The center is typically open ${hours}.`, [
        claim(loc, cid('phone'), 'phone', phone),
        claim(loc, cid('hours'), 'hours', hours),
      ])
    }
    case 'p8': {
      const addr = f.address.value ?? `${loc.neighborhood}, ${loc.city}`
      return out(`${name} is located at ${addr}. Drop-off parking is available on the adjoining lane, according to parent reviews.`, [
        claim(loc, cid('addr'), 'address', addr),
      ])
    }
    case 'p10': {
      const programs = f.programs.value ?? 'Playgroup, Nursery, LKG, UKG'
      return out(`${name} offers ${programs}. Admission windows usually open in January.`, [claim(loc, cid('prog'), 'programs', programs)])
    }
    default: {
      const addr = f.address.value ?? `${loc.neighborhood}, ${loc.city}`
      return out(`Here's what is publicly listed for ${name}: it is located at ${addr}. For specifics, the center's official page is the most reliable source.`, [
        claim(loc, cid('addr'), 'address', addr),
      ])
    }
  }
}

export function buildObservation(audit: Audit, wave: number, loc: Location, prompt: PromptTemplate, index: number, sampledBase: string, surface: SurfaceId = 'A'): Observation {
  const built = prompt.includeInDiscoveryMetric ? buildDiscovery(loc, prompt, wave, surface) : buildBranded(loc, prompt, wave)
  // Sampled during the ~10 minutes before the run completed.
  const sampledAt = new Date(new Date(sampledBase).getTime() - 600_000 + index * 7_000).toISOString()
  return {
    id: `${audit.id}${surface === 'B' ? '-B' : ''}${wave === 0 ? '' : `-w${wave}`}-${loc.id}-${prompt.id}`,
    auditId: audit.id,
    wave,
    locationId: loc.id,
    promptId: prompt.id,
    query: fillPrompt(prompt.text, loc),
    sampledAt,
    surface,
    answerText: built.text,
    mentioned: built.mentioned,
    mentionedBrand: built.mentionedBrand ?? built.mentioned,
    otherBranchName: built.otherBranchName,
    position: built.position,
    extractedClaims: built.claims,
    citations: built.citations,
    simulated: true,
  }
}
