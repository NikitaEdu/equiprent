import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api, ApiError, unitStatusLabel, type Category, type EquipmentDetails, type EquipmentSummary, type Page,
  type Timeline as TimelineData, type Unit,
} from '../lib/api'
import { addMonths, endOfMonth, formatMonth, startOfMonth, todayKyiv, type IsoDate } from '../lib/dates'
import { Timeline } from '../components/Timeline'
import { ErrorBox, InventoryTag, Loading, Notice } from '../components/States'

export function ManagerEquipmentPage() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('id')
  const [creating, setCreating] = useState(false)
  const list = useQuery({
    queryKey: ['equipment', 'manager-list'],
    queryFn: () => api.get<Page<EquipmentSummary>>('/api/equipment', { size: 48 }),
  })

  return (
    <section>
      <div className="page-head">
        <h1>Обладнання та екземпляри</h1>
        <button type="button" className="btn btn-primary" onClick={() => { setCreating(true); setParams({}) }}>
          Додати позицію
        </button>
      </div>
      <div className="manager-split">
        <nav className="type-list" aria-label="Позиції каталогу">
          {list.isLoading && <Loading />}
          {list.isError && <ErrorBox error={list.error} />}
          <ul>
            {list.data?.items.map((e) => (
              <li key={e.id}>
                <button type="button" aria-current={selected === String(e.id) ? 'true' : undefined}
                  className={selected === String(e.id) ? 'is-active' : ''}
                  onClick={() => { setCreating(false); setParams({ id: String(e.id) }) }}>
                  <span>{e.name}</span><small>{e.category.name} · {e.availableUnits} у роботі</small>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="type-detail">
          {creating && <TypeForm onDone={(id) => { setCreating(false); setParams({ id: String(id) }) }} />}
          {!creating && selected && <TypeDetail id={selected} key={selected} />}
          {!creating && !selected && (
            <div className="empty"><h2>Оберіть позицію зліва</h2>
              <p>Тут з’являться часова діаграма екземплярів, їхній стан і тарифи.</p></div>
          )}
        </div>
      </div>
    </section>
  )
}

function TypeDetail({ id }: { id: string }) {
  const today = todayKyiv()
  const [month, setMonth] = useState<IsoDate>(startOfMonth(today))
  const [editing, setEditing] = useState(false)
  const qc = useQueryClient()
  const details = useQuery({ queryKey: ['manager', 'equipment', id], queryFn: () => api.get<EquipmentDetails>(`/api/manager/equipment/${id}`) })
  const units = useQuery({ queryKey: ['manager', 'units', id], queryFn: () => api.get<Unit[]>(`/api/manager/equipment/${id}/units`) })
  const timeline = useQuery({
    queryKey: ['manager', 'timeline', id, month],
    queryFn: () => api.get<TimelineData>(`/api/manager/equipment/${id}/timeline`, { from: month, to: endOfMonth(month) }),
  })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['manager'] })
    qc.invalidateQueries({ queryKey: ['equipment'] })
    qc.invalidateQueries({ queryKey: ['availability'] })
  }
  const changeUnit = useMutation({
    mutationFn: ({ unitId, status }: { unitId: number; status: Unit['status'] }) =>
      api.patch<Unit>(`/api/manager/units/${unitId}`, { status }),
    onSuccess: refresh,
  })

  if (details.isLoading) return <Loading />
  if (details.isError) return <ErrorBox error={details.error} />
  const e = details.data!
  if (editing) return <TypeForm existing={e} onDone={() => { setEditing(false); refresh() }} onCancel={() => setEditing(false)} />

  return (
    <div className="stack">
      <header className="detail-head">
        <div>
          <h2 className="h-lg">{e.name}</h2>
          <p className="detail-sub">{e.category.name}{e.brand ? `, ${e.brand}` : ''} · перерва після оренди: {e.serviceBufferDays} дн.</p>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>Редагувати</button>
      </header>

      <section className="panel" aria-labelledby="tl-title">
        <div className="calendar-head">
          <h3 id="tl-title">Зайнятість — {formatMonth(month)}</h3>
          <div className="calendar-nav">
            <button type="button" className="btn btn-quiet" onClick={() => setMonth(addMonths(month, -1))} aria-label="Попередній місяць">‹</button>
            <button type="button" className="btn btn-quiet" onClick={() => setMonth(addMonths(month, 1))} aria-label="Наступний місяць">›</button>
          </div>
        </div>
        {timeline.isLoading && <Loading />}
        {timeline.isError && <ErrorBox error={timeline.error} />}
        {timeline.data && <Timeline data={timeline.data} today={today} />}
        <ul className="legend">
          <li><span className="sw st-pending" />очікує</li><li><span className="sw st-confirmed" />підтверджено</li>
          <li><span className="sw st-issued" />видано</li><li><span className="sw st-returned" />повернено</li>
          <li><span className="sw sw-buffer" />технічна перерва</li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="units-title">
        <h3 id="units-title">Екземпляри</h3>
        {changeUnit.isError && <ErrorBox error={changeUnit.error} />}
        {units.data && (
          <table className="data-table">
            <thead><tr><th scope="col">Інвентарний номер</th><th scope="col">Стан</th><th scope="col">Примітка</th></tr></thead>
            <tbody>
              {units.data.map((u) => (
                <tr key={u.id}>
                  <td><InventoryTag value={u.inventoryNumber} /></td>
                  <td>
                    <label className="sr-only" htmlFor={`unit-${u.id}`}>Стан екземпляра {u.inventoryNumber}</label>
                    <select id={`unit-${u.id}`} value={u.status} disabled={changeUnit.isPending}
                      onChange={(ev) => changeUnit.mutate({ unitId: u.id, status: ev.target.value as Unit['status'] })}>
                      {(['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as const).map((s) => <option key={s} value={s}>{unitStatusLabel[s]}</option>)}
                    </select>
                  </td>
                  <td>{u.conditionNote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <AddUnitForm typeId={e.id} onAdded={refresh} />
        <p className="hint">Екземпляр на обслуговуванні не потрапляє в нові бронювання; наявні бронювання
          лишаються на діаграмі, щоб ви вирішили, що з ними робити.</p>
      </section>
    </div>
  )
}

function AddUnitForm({ typeId, onAdded }: { typeId: number; onAdded: () => void }) {
  const [inv, setInv] = useState('')
  const add = useMutation({
    mutationFn: () => api.post<Unit>(`/api/manager/equipment/${typeId}/units`, { inventoryNumber: inv.trim() }),
    onSuccess: () => { setInv(''); onAdded() },
  })
  const err = add.error instanceof ApiError ? add.error : null
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
      <div className="field">
        <label htmlFor="inv">Новий інвентарний номер</label>
        <input id="inv" value={inv} onChange={(e) => setInv(e.target.value)} placeholder="EQ-01-004" maxLength={30}
          aria-invalid={!!err} aria-describedby={err ? 'inv-err' : undefined} />
        {err && <p id="inv-err" className="field-error">{err.fieldError('inventoryNumber') ?? err.message}</p>}
      </div>
      <button type="submit" className="btn btn-quiet" disabled={!inv.trim() || add.isPending}>Додати екземпляр</button>
    </form>
  )
}

interface TierDraft { minDays: string; dailyRate: string }

function TypeForm({ existing, onDone, onCancel }: { existing?: EquipmentDetails; onDone: (id: number) => void; onCancel?: () => void }) {
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories') })
  const [f, setF] = useState({
    categoryId: existing ? String(existing.category.id) : '',
    name: existing?.name ?? '', brand: existing?.brand ?? '', description: existing?.description ?? '',
    deposit: existing ? String(existing.deposit) : '', serviceBufferDays: String(existing?.serviceBufferDays ?? 0),
    maxRentalDays: String(existing?.maxRentalDays ?? 14), lateFeeMultiplier: String(existing?.lateFeeMultiplier ?? '1.5'),
  })
  const [tiers, setTiers] = useState<TierDraft[]>(existing
    ? existing.tariffs.map((t) => ({ minDays: String(t.minDays), dailyRate: String(t.dailyRate) }))
    : [{ minDays: '1', dailyRate: '' }])
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId: Number(f.categoryId) || null, name: f.name, brand: f.brand, description: f.description,
        deposit: f.deposit === '' ? null : Number(f.deposit.replace(',', '.')),
        serviceBufferDays: Number(f.serviceBufferDays), maxRentalDays: Number(f.maxRentalDays),
        lateFeeMultiplier: Number(f.lateFeeMultiplier.replace(',', '.')),
        tariffs: tiers.map((t) => ({ minDays: Number(t.minDays), dailyRate: t.dailyRate === '' ? null : Number(t.dailyRate.replace(',', '.')) })),
      }
      return existing ? api.put<EquipmentDetails>(`/api/manager/equipment/${existing.id}`, body)
        : api.post<EquipmentDetails>('/api/manager/equipment', body)
    },
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['equipment'] }); onDone(d.id) },
  })
  const err = save.error instanceof ApiError ? save.error : null
  const fe = (k: string) => err?.fieldError(k)
  const input = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
        aria-invalid={!!fe(k)} aria-describedby={fe(k) ? `f-${k}-err` : undefined} {...props} />
      {fe(k) && <p id={`f-${k}-err`} className="field-error">{fe(k)}</p>}
    </div>
  )

  return (
    <form className="panel stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }} noValidate>
      <h2 className="h-lg">{existing ? 'Редагування позиції' : 'Нова позиція каталогу'}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="f-category">Категорія</label>
          <select id="f-category" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}
            aria-invalid={!!fe('categoryId')}>
            <option value="">Оберіть…</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {fe('categoryId') && <p className="field-error">{fe('categoryId')}</p>}
        </div>
        {input('name', 'Назва', { maxLength: 150 })}
        {input('brand', 'Бренд', { maxLength: 80 })}
        {input('deposit', 'Застава, грн', { inputMode: 'decimal' })}
        {input('serviceBufferDays', 'Технічна перерва після оренди, діб', { type: 'number', min: 0, max: 7 })}
        {input('maxRentalDays', 'Найдовша оренда, діб', { type: 'number', min: 1, max: 365 })}
        {input('lateFeeMultiplier', 'Коефіцієнт плати за запізнення', { inputMode: 'decimal' })}
      </div>
      <div className="field">
        <label htmlFor="f-description">Опис і комплектація</label>
        <textarea id="f-description" rows={3} value={f.description} maxLength={4000}
          onChange={(e) => setF({ ...f, description: e.target.value })} aria-invalid={!!fe('description')} />
        {fe('description') && <p className="field-error">{fe('description')}</p>}
      </div>
      <fieldset className="tiers">
        <legend>Ступені тарифу</legend>
        <p className="hint">Перший ступінь — від 1 доби. Для довшої оренди ставка не може зростати, а загальна
          вартість — зменшуватися при переході на наступний ступінь.</p>
        {tiers.map((t, i) => (
          <div className="tier-row" key={i}>
            <div className="field">
              <label htmlFor={`t-min-${i}`}>Від, діб</label>
              <input id={`t-min-${i}`} type="number" min={1} value={t.minDays}
                onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, minDays: e.target.value } : x))} />
            </div>
            <div className="field">
              <label htmlFor={`t-rate-${i}`}>Ставка за добу, грн</label>
              <input id={`t-rate-${i}`} inputMode="decimal" value={t.dailyRate}
                onChange={(e) => setTiers(tiers.map((x, j) => j === i ? { ...x, dailyRate: e.target.value } : x))} />
            </div>
            {tiers.length > 1 && (
              <button type="button" className="btn btn-quiet btn-small" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
                Прибрати
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-quiet btn-small"
          onClick={() => setTiers([...tiers, { minDays: '', dailyRate: '' }])}>Додати ступінь</button>
      </fieldset>
      {err && !err.fieldErrors.length && <ErrorBox error={err} />}
      {err && err.fieldErrors.length > 0 && <Notice kind="warning">Перевірте позначені поля.</Notice>}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Зберігаємо…' : existing ? 'Зберегти зміни' : 'Створити позицію'}
        </button>
        {onCancel && <button type="button" className="btn btn-quiet" onClick={onCancel}>Скасувати</button>}
      </div>
    </form>
  )
}
