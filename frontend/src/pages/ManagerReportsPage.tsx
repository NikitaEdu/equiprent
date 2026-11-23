import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, uah, type UtilizationReport } from '../lib/api'
import { addDays, formatRange, todayKyiv } from '../lib/dates'
import { ErrorBox, Loading } from '../components/States'

const pct = (v: number) => `${(Number(v) * 100).toFixed(1).replace('.', ',')} %`

export function ManagerReportsPage() {
  const today = todayKyiv()
  const [from, setFrom] = useState(addDays(today, -29))
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from, to })
  const report = useQuery({
    queryKey: ['manager', 'report', applied.from, applied.to],
    queryFn: () => api.get<UtilizationReport>('/api/manager/reports/utilization', applied),
  })

  return (
    <section>
      <h1>Завантаженість обладнання</h1>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setApplied({ from, to }) }}>
        <div className="field"><label htmlFor="rf">З</label><input id="rf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="rt">По</label><input id="rt" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button type="submit" className="btn btn-primary">Сформувати</button>
      </form>
      <p className="hint">Завантаженість — частка екземпляро-діб оренди (підтверджені, видані й повернені
        бронювання, без технічних перерв) від усіх екземпляро-діб періоду. Дохід — повернені в цьому періоді оренди.</p>
      {report.isLoading && <Loading />}
      {report.isError && <ErrorBox error={report.error} onRetry={() => report.refetch()} />}
      {report.data && (
        <>
          <dl className="summary">
            <div><dt>Період</dt><dd>{formatRange(report.data.from, report.data.to)} ({report.data.days} дн.)</dd></div>
            <div><dt>Середня завантаженість</dt><dd>{pct(report.data.overallUtilization)}</dd></div>
            <div><dt>Дохід</dt><dd>{uah(report.data.totalRevenue)}</dd></div>
          </dl>
          <div className="table-wrap" role="region" tabIndex={0} aria-label="Таблиця завантаженості">
            <table className="data-table">
              <thead>
                <tr><th scope="col">Позиція</th><th scope="col" className="num">Екземплярів</th>
                  <th scope="col" className="num">Бронювань</th><th scope="col" className="num">Екз.-діб оренди</th>
                  <th scope="col">Завантаженість</th><th scope="col" className="num">Дохід</th></tr>
              </thead>
              <tbody>
                {report.data.rows.map((r) => (
                  <tr key={r.equipmentTypeId}>
                    <td>{r.name}</td><td className="num">{r.units}</td><td className="num">{r.bookings}</td>
                    <td className="num">{r.occupiedUnitDays}</td>
                    <td><span className="bar-cell"><span className="bar" style={{ width: `${Math.min(100, Number(r.utilization) * 100)}%` }} />
                      <span>{pct(r.utilization)}</span></span></td>
                    <td className="num">{uah(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
