import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Table({ className, children, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="scrollbar-thin w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-[13.5px]', className)} {...p}>
        {children}
      </table>
    </div>
  )
}

export function Th({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('h-10 whitespace-nowrap border-b border-line bg-subtle px-4 text-[12px] font-medium uppercase tracking-[0.04em] text-muted first:pl-5 last:pr-5', className)} {...p} />
}

export function SortTh<K extends string>({ label, sortKey, sort, onSort, align = 'left', className }: { label: ReactNode; sortKey: K; sort: { key: K; dir: 'asc' | 'desc' }; onSort: (k: K) => void; align?: 'left' | 'right'; className?: string }) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <Th className={cn(align === 'right' && 'text-right', className)} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 uppercase tracking-[0.04em] hover:text-ink', active && 'text-ink', align === 'right' && 'flex-row-reverse')}>
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} />
      </button>
    </Th>
  )
}

export function Td({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('h-[52px] border-b border-line px-4 align-middle first:pl-5 last:pr-5', className)} {...p} />
}

export function Tr({ className, onClick, ...p }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors duration-150 last:[&>td]:border-b-0', onClick && 'cursor-pointer hover:bg-[#f7f9fd]', className)} onClick={onClick} {...p} />
}
