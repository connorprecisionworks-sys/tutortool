import { formatCents } from "@/lib/money";

export function TopStudentsList({ students }: { students: { studentName: string; cents: number }[] }) {
  const max = Math.max(1, ...students.map((s) => s.cents));

  return (
    <ul className="space-y-3">
      {students.map((s) => (
        <li key={s.studentName}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span>{s.studentName}</span>
            <span className="tabular-nums text-text-secondary">{formatCents(s.cents)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.round((s.cents / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
