/*
  Simulated audit runner. No network requests, provider keys or scraping —
  it only paces the UI through the stages a real run would have.
  Observations themselves are generated deterministically from the audit scope.
*/

export type RunStage = 'preparing' | 'running' | 'extracting' | 'complete'

export const RUN_STAGES: { id: RunStage; label: string; detail: string }[] = [
  { id: 'preparing', label: 'Preparing scope', detail: 'Resolving prompts for each center' },
  { id: 'running', label: 'Sampling answers', detail: 'Querying AI search for each prompt' },
  { id: 'extracting', label: 'Extracting & checking claims', detail: 'Comparing claims with verified records' },
  { id: 'complete', label: 'Complete', detail: 'Results ready for review' },
]

export interface RunProgress {
  stage: RunStage
  completed: number
  total: number
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function runSimulatedAudit(total: number, onProgress: (p: RunProgress) => void, signal?: { cancelled: boolean }) {
  onProgress({ stage: 'preparing', completed: 0, total })
  await wait(700)
  const steps = 16
  for (let i = 1; i <= steps; i++) {
    if (signal?.cancelled) return false
    await wait(160)
    onProgress({ stage: 'running', completed: Math.round((total * i) / steps), total })
  }
  onProgress({ stage: 'extracting', completed: total, total })
  await wait(1100)
  if (signal?.cancelled) return false
  onProgress({ stage: 'complete', completed: total, total })
  return true
}
