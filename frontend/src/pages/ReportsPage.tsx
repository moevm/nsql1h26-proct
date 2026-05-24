export function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Отчёты</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Раздел находится в разработке</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-[15px] mb-2" style={{ fontWeight: 600 }}>Скоро здесь появятся отчёты</h3>
        <p className="text-[13px] text-muted-foreground">
          Функциональность экспорта и просмотра аналитических отчётов будет добавлена позже.
        </p>
      </div>
    </div>
  );
}
