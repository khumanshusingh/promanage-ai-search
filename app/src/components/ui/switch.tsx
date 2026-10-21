import * as S from '@radix-ui/react-switch'

export function Switch({ checked, onCheckedChange, disabled, id, ...p }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; id?: string; 'aria-label'?: string }) {
  return (
    <S.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="relative h-5 w-9 shrink-0 rounded-full bg-[#cfd8e3] transition-colors duration-150 data-[state=checked]:bg-brand disabled:opacity-50"
      {...p}
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  )
}
