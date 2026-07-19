"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTutor } from "@/lib/auth/tutor";
import { SYSTEM_EMAIL_TEMPLATES, type CustomEmailTemplate } from "@/lib/email-templates";
import { NOTIFICATION_TOGGLES, type NotificationSettings } from "@/lib/notification-settings";
import type { ReminderTemplates } from "@/lib/reminders";
import type { Json } from "@/lib/database.types";

function validateTemplate(subject: string, body: string): string | null {
  if (!subject.trim()) return "Subject is required.";
  if (!body.trim()) return "Body is required.";
  return null;
}

export async function updateSystemTemplateAction(
  templateKey: string,
  subject: string,
  body: string
): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  if (!SYSTEM_EMAIL_TEMPLATES.some((t) => t.key === templateKey)) return { error: "Template not found." };
  const validationError = validateTemplate(subject, body);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const existing = (tutor.reminder_templates as unknown as ReminderTemplates) ?? {};
  const updated: ReminderTemplates = { ...existing, [templateKey]: { subject: subject.trim(), body: body.trim() } };

  const { error } = await supabase.from("tutors").update({ reminder_templates: updated as unknown as Json }).eq("id", tutor.id);
  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/email");
  return {};
}

export async function createCustomTemplateAction(
  name: string,
  subject: string,
  body: string
): Promise<{ error?: string; id?: string }> {
  const tutor = await requireTutor();
  if (!name.trim()) return { error: "Name is required." };
  const validationError = validateTemplate(subject, body);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const existing = (tutor.custom_email_templates as unknown as CustomEmailTemplate[]) ?? [];
  const id = crypto.randomUUID();
  const updated = [...existing, { id, name: name.trim(), subject: subject.trim(), body: body.trim() }];

  const { error } = await supabase.from("tutors").update({ custom_email_templates: updated as unknown as Json }).eq("id", tutor.id);
  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/email");
  return { id };
}

export async function updateCustomTemplateAction(
  id: string,
  name: string,
  subject: string,
  body: string
): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  if (!name.trim()) return { error: "Name is required." };
  const validationError = validateTemplate(subject, body);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const existing = (tutor.custom_email_templates as unknown as CustomEmailTemplate[]) ?? [];
  if (!existing.some((t) => t.id === id)) return { error: "Template not found." };
  const updated = existing.map((t) => (t.id === id ? { id, name: name.trim(), subject: subject.trim(), body: body.trim() } : t));

  const { error } = await supabase.from("tutors").update({ custom_email_templates: updated as unknown as Json }).eq("id", tutor.id);
  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/email");
  return {};
}

export async function deleteCustomTemplateAction(id: string): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();
  const existing = (tutor.custom_email_templates as unknown as CustomEmailTemplate[]) ?? [];
  const updated = existing.filter((t) => t.id !== id);

  const { error } = await supabase.from("tutors").update({ custom_email_templates: updated as unknown as Json }).eq("id", tutor.id);
  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/email");
  return {};
}

export async function updateNotificationSettingsAction(formData: FormData): Promise<{ error?: string }> {
  const tutor = await requireTutor();
  const supabase = await createClient();

  const settings: NotificationSettings = {};
  for (const toggle of NOTIFICATION_TOGGLES) {
    settings[toggle.key] = formData.get(toggle.key) === "on";
  }

  const { error } = await supabase.from("tutors").update({ notification_settings: settings as unknown as Json }).eq("id", tutor.id);
  if (error) return { error: error.message };

  revalidatePath("/tutor/settings/email");
  return {};
}
