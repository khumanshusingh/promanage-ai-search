import { useMemo, useState } from 'react'

export interface SortState<K extends string> {
  key: K
  dir: 'asc' | 'desc'
}

export function useSort<T, K extends string>(rows: T[], initial: SortState<NoInfer<K>>, accessors: Record<K, (row: T) => string | number>) {
  const [sort, setSort] = useState<SortState<K>>(initial)
  const sorted = useMemo(() => {
    const get = accessors[sort.key]
    return [...rows].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort])
  const onSort = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: rows.length && typeof accessors[key](rows[0]) === 'number' ? 'desc' : 'asc' }))
  return { sorted, sort, onSort }
}
