export default function BriefCompare({ briefCompare }) {
  if (!briefCompare) return null

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '—'
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }

  const formatDelta = (value) => {
    if (value === null || value === undefined) return '—'
    const sign = value > 0 ? '+' : ''
    return `${sign}${formatNumber(value)}`
  }

  return (
    <div className="rightbar__section">
      <div className="rightbar__title">Yesterday vs Today</div>
      <div className="rightbar__item">
        Today: {briefCompare.today.created}
      </div>
      <div className="rightbar__item">
        Yesterday: {briefCompare.yesterday.created}
      </div>
      {['S&P 500', 'Nasdaq', 'Dow', 'BTC', 'ETH'].map((key) => {
        const today = briefCompare.todayMarkets[key]
        const yesterday = briefCompare.yesterdayMarkets[key]
        const delta = (today?.value ?? null) !== null && (yesterday?.value ?? null) !== null
          ? today.value - yesterday.value
          : null

        return (
          <div key={key} className="rightbar__snippet">
            <strong>{key}:</strong>{' '}
            {formatNumber(yesterday?.value)} → {formatNumber(today?.value)} ({formatDelta(delta)})
          </div>
        )
      })}
    </div>
  )
}
