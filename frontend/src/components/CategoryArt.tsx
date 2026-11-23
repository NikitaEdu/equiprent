import type { JSX } from 'react'

/**
 * Власні схематичні ілюстрації категорій (замість фотографій товарів):
 * у демонстраційних даних немає зображень, на які є права.
 */
const shapes: Record<string, JSX.Element> = {
  'photo-video': (
    <>
      <rect x="10" y="22" width="60" height="38" rx="6" />
      <rect x="24" y="14" width="18" height="10" rx="2" />
      <circle cx="40" cy="41" r="12" className="hole" />
      <circle cx="40" cy="41" r="6" />
    </>
  ),
  audio: (
    <>
      <rect x="22" y="10" width="36" height="60" rx="6" />
      <circle cx="40" cy="50" r="12" className="hole" />
      <circle cx="40" cy="25" r="6" className="hole" />
    </>
  ),
  tools: (
    <>
      <rect x="10" y="26" width="38" height="18" rx="4" />
      <rect x="48" y="31" width="22" height="8" rx="2" />
      <rect x="22" y="44" width="14" height="24" rx="3" />
    </>
  ),
  camping: (
    <>
      <path d="M8 66 L40 14 L72 66 Z" />
      <path d="M33 66 L40 46 L47 66 Z" className="hole" />
    </>
  ),
  presentation: (
    <>
      <rect x="10" y="12" width="60" height="38" rx="3" />
      <rect x="16" y="18" width="48" height="26" className="hole" />
      <rect x="37" y="50" width="6" height="14" />
      <rect x="24" y="62" width="32" height="5" rx="2" />
    </>
  ),
}

export function CategoryArt({ slug, label }: { slug: string; label?: string }) {
  return (
    <svg className={`art art-${slug}`} viewBox="0 0 80 80" role={label ? 'img' : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      {shapes[slug] ?? <rect x="14" y="14" width="52" height="52" rx="8" />}
    </svg>
  )
}
