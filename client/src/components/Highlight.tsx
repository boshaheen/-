interface Props {
  text: string
  start: number
  end: number
}

/** Renders `text` with the [start, end) slice wrapped in <mark>. */
export default function Highlight({ text, start, end }: Props) {
  const before = text.slice(0, start)
  const match = text.slice(start, end)
  const after = text.slice(end)
  return (
    <span dir="auto">
      {before}
      <mark className="rounded bg-amber-400/90 px-0.5 text-black">{match}</mark>
      {after}
    </span>
  )
}
