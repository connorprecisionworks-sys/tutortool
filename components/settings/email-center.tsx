"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/input";
import { EmailTemplateCard } from "@/components/settings/email-template-card";
import { NewCustomTemplateCard } from "@/components/settings/new-custom-template-card";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { SYSTEM_EMAIL_TEMPLATES, resolveSystemTemplate, type CustomEmailTemplate } from "@/lib/email-templates";
import {
  updateSystemTemplateAction,
  updateCustomTemplateAction,
  deleteCustomTemplateAction,
} from "@/app/tutor/settings/email/actions";
import type { ReminderTemplates } from "@/lib/reminders";
import type { NotificationSettings } from "@/lib/notification-settings";

export function EmailCenter({
  reminderTemplates,
  customTemplates,
  notificationSettings,
}: {
  reminderTemplates: ReminderTemplates;
  customTemplates: CustomEmailTemplate[];
  notificationSettings: NotificationSettings | null;
}) {
  const [customs, setCustoms] = useState(customTemplates);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold">Notifications</h2>
        <NotificationSettingsForm settings={notificationSettings} />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Templates</h2>
        <FieldHint className="mt-0 mb-3">
          Use {"{{student}}"}, {"{{tutor}}"}, {"{{amount}}"}, {"{{link}}"}, and more — insert them below each field. Collapsed
          by default; click a template to edit and preview it.
        </FieldHint>
        <div className="space-y-3">
          {SYSTEM_EMAIL_TEMPLATES.map((def) => {
            const current = resolveSystemTemplate(reminderTemplates, def.key);
            return (
              <EmailTemplateCard
                key={def.key}
                name={def.name}
                audience={def.audience}
                trigger={def.trigger}
                variables={def.variables}
                ctaLabel={def.ctaLabel}
                subject={current.subject}
                body={current.body}
                onSave={(subject, body) => updateSystemTemplateAction(def.key, subject, body)}
              />
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your templates</h2>
          {!creating && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreating(true)}>
              New template
            </Button>
          )}
        </div>
        <FieldHint className="mt-0 mb-3">Saved here for your own reference and preview — not sent automatically yet.</FieldHint>
        <div className="space-y-3">
          {creating && (
            <NewCustomTemplateCard
              onCreated={(t) => {
                setCustoms((prev) => [...prev, t]);
                setCreating(false);
              }}
              onCancel={() => setCreating(false)}
            />
          )}
          {customs.length === 0 && !creating && <p className="text-sm text-text-secondary">No custom templates yet.</p>}
          {customs.map((t) => (
            <EmailTemplateCard
              key={t.id}
              name={t.name}
              audience="parent"
              trigger="Custom template — for your own use."
              subject={t.subject}
              body={t.body}
              editableName
              onRename={(newName) => setCustoms((prev) => prev.map((x) => (x.id === t.id ? { ...x, name: newName } : x)))}
              onSave={(subject, body) => updateCustomTemplateAction(t.id, t.name, subject, body)}
              onDelete={async () => {
                const result = await deleteCustomTemplateAction(t.id);
                if (!result.error) setCustoms((prev) => prev.filter((x) => x.id !== t.id));
                return result;
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
