import { useEffect, useState } from 'react'

export default function Outline({ outline, activeDoc }) {
  const [activeHeadingId, setActiveHeadingId] = useState(null)

  /* eslint-disable react-hooks/set-state-in-effect -- intentional: sync heading state on doc change + IntersectionObserver */
  useEffect(() => {
    const defaultId = outline[0]?.id || null
    setActiveHeadingId(defaultId)

    if (!activeDoc) return
    const headings = Array.from(document.querySelectorAll('.doc__content h2[id], .doc__content h3[id]'))
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id)
          }
        })
      },
      { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
    )

    headings.forEach((heading) => observer.observe(heading))

    return () => observer.disconnect()
  }, [activeDoc, outline])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="rightbar__section">
      <div className="rightbar__title">Outline</div>
      {outline.length ? (
        outline.map((item) => (
          <button
            key={item.id}
            className={`rightbar__outline rightbar__item--indent-${item.level} ${
              activeHeadingId === item.id ? 'is-active' : ''
            }`}
            onClick={() => {
              const el = document.getElementById(item.id)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            {item.text}
          </button>
        ))
      ) : (
        <div className="rightbar__item">No headings found.</div>
      )}
    </div>
  )
}
