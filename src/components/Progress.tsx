import { Check } from "./Icons";

export default function Progress({
  phases,
  active,
  percent,
}: {
  phases: string[];
  active: number;
  percent: number;
}) {
  return (
    <div className="progress" aria-live="polite">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
      </div>
      <div className="phases">
        {phases.map((p, i) => (
          <div key={p} className={`phase${i < active ? " done" : i === active ? " active" : ""}`}>
            <span className="dot">{i < active && <Check size={11} />}</span>
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
