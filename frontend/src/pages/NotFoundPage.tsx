import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="state">
      <h1>Сторінку не знайдено</h1>
      <p>Адреса неправильна або сторінку переміщено.</p>
      <Link to="/" className="btn btn-primary">Перейти до каталогу</Link>
    </section>
  )
}
