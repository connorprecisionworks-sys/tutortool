import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";
import { getLinkedStudents } from "@/lib/auth/linked-students";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";

interface VisibleSession {
  id: string;
  client_id: string;
  occurred_on: string;
  duration_minutes: number;
  location: string | null;
  meeting_link: string | null;
}

export default async function ParentSessionsPage() {
  const parentUser = await requireParent();
  const supabase = await createClient();

  const students = await getLinkedStudents(supabase, parentUser.id);
  const studentIds = students.map((s) => s.id);
  const studentNames = new Map(students.map((s) => [s.id, s.name]));

  if (studentIds.length === 0) {
    return (
      <div>
        <PageHeader title="Sessions & Notes" description="Upcoming and past sessions, plus notes your tutor has shared." />
        <EmptyState message="Link your child's account from Home to see sessions here." />
      </div>
    );
  }

  const { data: rawSessions } = await supabase
    .from("parent_visible_sessions")
    .select("*")
    .in("client_id", studentIds)
    .order("occurred_on", { ascending: false });

  // The view's columns mirror NOT NULL base-table columns, but Postgres
  // views don't propagate that metadata, so the generated types come back
  // nullable — normalize once here instead of casting at every use site.
  const sessions: VisibleSession[] = (rawSessions ?? [])
    .filter((s): s is typeof s & { id: string; client_id: string; occurred_on: string; duration_minutes: number } =>
      Boolean(s.id && s.client_id && s.occurred_on && s.duration_minutes != null)
    )
    .map((s) => ({
      id: s.id,
      client_id: s.client_id,
      occurred_on: s.occurred_on,
      duration_minutes: s.duration_minutes,
      location: s.location,
      meeting_link: s.meeting_link,
    }));

  const sessionIds = sessions.map((s) => s.id);
  const { data: notes } = sessionIds.length
    ? await supabase.from("session_notes").select("*").in("session_id", sessionIds)
    : { data: [] };

  const noteBySession = new Map((notes ?? []).map((n) => [n.session_id, n]));

  if (sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Sessions & Notes" description="Upcoming and past sessions, plus notes your tutor has shared." />
        <EmptyState message="No sessions logged yet." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Sessions & Notes" description="Upcoming and past sessions, plus notes your tutor has shared." />
      <div className="space-y-3">
        {sessions.map((s) => {
          const note = noteBySession.get(s.id);
          return (
            <Card key={s.id}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">
                  {formatDate(s.occurred_on)} · {studentNames.get(s.client_id)}
                </p>
                <p className="text-xs text-text-secondary">{s.duration_minutes} min</p>
              </div>
              {s.location && <p className="mt-1 text-xs text-text-tertiary">{s.location}</p>}
              {s.meeting_link && (
                <p className="mt-1 text-xs">
                  <a
                    href={s.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline underline-offset-2 hover:text-text"
                  >
                    Join meeting ↗
                  </a>
                </p>
              )}
              {note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{note.body}</p>
              ) : (
                <p className="mt-2 text-xs text-text-tertiary">No note shared for this session.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
