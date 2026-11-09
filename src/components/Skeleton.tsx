export function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Carregando previsão">
      <div className="skeleton__col">
        <span className="skeleton__bar" style={{ width: 90, height: 28 }} />
        <span className="skeleton__bar" style={{ width: '70%', height: 72 }} />
        <span className="skeleton__bar" style={{ width: '55%', height: 18 }} />
        <span className="skeleton__bar" style={{ width: '100%', height: 200 }} />
      </div>
      <div className="skeleton__col">
        <span className="skeleton__bar" style={{ width: '100%', height: 260 }} />
        <span className="skeleton__bar" style={{ width: '100%', height: 90 }} />
      </div>
    </div>
  );
}
