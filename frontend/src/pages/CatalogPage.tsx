import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, uah, type Category, type EquipmentSummary, type Page } from '../lib/api'
import { CategoryArt } from '../components/CategoryArt'
import { Empty, ErrorBox, Loading, Pager } from '../components/States'

const PAGE_SIZE = 12

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const categoryId = params.get('category') ?? ''
  const sort = params.get('sort') ?? 'name'
  const page = Number(params.get('page') ?? '0')
  const [draft, setDraft] = useState(q)

  useEffect(() => { setDraft(q) }, [q])

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/api/categories') })
  const list = useQuery({
    queryKey: ['equipment', q, categoryId, sort, page],
    queryFn: () => api.get<Page<EquipmentSummary>>('/api/equipment',
      { q, categoryId, sort, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v)
      else merged.delete(k)
    }
    if (!('page' in next)) merged.delete('page')
    setParams(merged)
  }

  return (
    <div className="catalog">
      <section className="catalog-intro">
        <h1>Обладнання в оренду подобово</h1>
        <p>Оберіть річ, подивіться в календарі, скільки екземплярів вільно на ваші дати, і надішліть заявку.
          Менеджер підтвердить її, а забрати обладнання можна в перший день оренди.</p>
      </section>

      <form className="filters" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: draft.trim() }) }}>
        <div className="field field-grow">
          <label htmlFor="q">Пошук за назвою або брендом</label>
          <input id="q" type="search" value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Наприклад, проєктор" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="category">Категорія</label>
          <select id="category" value={categoryId} onChange={(e) => update({ category: e.target.value })}>
            <option value="">Усі категорії</option>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Порядок</label>
          <select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="name">За назвою</option>
            <option value="newest">Спочатку нові</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Знайти</button>
      </form>

      {list.isLoading && (
        <>
          <Loading label="Завантажуємо каталог…" />
          <ul className="equipment-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <li key={i} className="equipment-tile skeleton-tile" />)}
          </ul>
        </>
      )}
      {list.isError && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && (
        <Empty title="Нічого не знайдено">
          <p>Спробуйте інший запит або приберіть фільтр категорії.</p>
          {(q || categoryId) && (
            <button type="button" className="btn btn-quiet" onClick={() => setParams(new URLSearchParams())}>
              Скинути фільтри
            </button>
          )}
        </Empty>
      )}
      {list.data && list.data.items.length > 0 && (
        <>
          <p className="result-count" aria-live="polite">Знайдено позицій: {list.data.totalItems}</p>
          <ul className="equipment-grid">
            {list.data.items.map((e) => (
              <li key={e.id} className="equipment-tile">
                <Link to={`/equipment/${e.id}`} className="tile-link">
                  <span className="tile-art"><CategoryArt slug={e.category.slug} /></span>
                  <span className="tile-category">{e.category.name}</span>
                  <span className="tile-name">{e.name}</span>
                  {e.brand && <span className="tile-brand">{e.brand}</span>}
                  <span className="tile-foot">
                    <span className="tile-price">від {uah(e.priceFrom)} <small>за добу</small></span>
                    <span className={e.availableUnits === 0 ? 'tile-units none' : 'tile-units'}>
                      {e.availableUnits === 0 ? 'немає в роботі' : `екземплярів: ${e.availableUnits}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={list.data.page} totalPages={list.data.totalPages}
            onChange={(p) => update({ page: String(p) })} />
        </>
      )}
    </div>
  )
}
