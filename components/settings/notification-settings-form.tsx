"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_TOGGLES, isNotificationEnabled, type NotificationSettings } from "@/lib/notification-settings";
import { updateNotificationSettingsAction } from "@/app/tutor/settings/email/actions";

export function NotificationSettingsForm({ settings }: { settings: NotificationSettings | null }) {
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_TOGGLES.map((t) => [t.key, isNotificationEnabled(settings, t.key)]))
  );
  const [status, setStatus] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {NOTIFICATION_TOGGLES.map((toggle) => (
          <label key={toggle.key} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={values[toggle.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [toggle.key]: e.target.checked }))}
            />
            <span>
              <span className="block font-medium">{toggle.label}</span>
              <span className="block text-text-secondary">{toggle.description}</span>
            </span>
          </label>
        ))}
      </div>

      {status.error && <p className="text-sm text-text">{status.error}</p>}
      {status.saved && <p className="text-sm text-text-secondary">Saved.</p>}

      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setStatus({});
          startTransition(async () => {
            const formData = new FormData();
            for (const [key, value] of Object.entries(values)) {
              if (value) formData.set(key, "on");
            }
            const result = await updateNotificationSettingsAction(formData);
            setStatus(result.error ? { error: result.error } : { saved: true });
          });
        }}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
