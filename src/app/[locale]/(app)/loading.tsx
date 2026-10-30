// Ожидание загрузки страницы: геометрические макеты блоков с мягкой пульсацией, без спиннеров.
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="skeleton h-7 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-80 rounded-lg lg:col-span-2" />
        <div className="skeleton h-80 rounded-lg" />
      </div>
    </div>
  );
}
