"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { ShareButton } from "@/components/ui/share-button";
import { updatePublicProfileAction, type PublicProfileFormResult } from "@/app/tutor/settings/profile-actions";
import { publicAppUrl } from "@/lib/app-url";
import { avatarPublicUrl } from "@/lib/avatar-url";
import { formatCents } from "@/lib/money";
import { useHandleCheck, isHandleBlocked } from "@/lib/hooks/use-handle-check";
import { HandleCheckHint } from "@/components/settings/handle-check-hint";
import type { Tables } from "@/lib/database.types";

const initialState: PublicProfileFormResult = {};

type PreviewService = Pick<Tables<"services">, "id" | "name" | "description" | "duration_minutes" | "price_cents">;

export function PublicProfileForm({
  tutor,
  services,
}: {
  tutor: Tables<"tutors">;
  services: PreviewService[];
}) {
  const [state, formAction, pending] = useActionState(updatePublicProfileAction, initialState);

  // Controlled purely to drive the live preview pane — the <form> below
  // still submits every field through a normal FormData post (each input
  // keeps its `name`), untouched by this state living alongside it.
  const [handle, setHandle] = useState(tutor.handle ?? "");
  const [publicDisplayName, setPublicDisplayName] = useState(tutor.public_display_name ?? "");
  const [headline, setHeadline] = useState(tutor.headline ?? "");
  const [bio, setBio] = useState(tutor.bio ?? "");
  const [subjects, setSubjects] = useState(tutor.subjects ?? "");
  const [welcomeNote, setWelcomeNote] = useState(tutor.welcome_note ?? "");
  const [bookingCtaLabel, setBookingCtaLabel] = useState(tutor.booking_cta_label || "Book");
  const [showBio, setShowBio] = useState(tutor.show_bio);
  const [showPrices, setShowPrices] = useState(tutor.show_prices);
  const [showPhone, setShowPhone] = useState(tutor.show_phone);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarPublicUrl(tutor.avatar_path));
  const handleCheck = useHandleCheck(handle, tutor.handle);
  const handleBlocked = isHandleBlocked(handleCheck.status);
  const hasPhone = Boolean(tutor.phone);

  const publicUrl = tutor.handle ? `${publicAppUrl()}/t/${tutor.handle}` : null;
  const displayName = publicDisplayName.trim() || tutor.name;

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }


  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        {tutor.is_public && publicUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken px-4 py-3">
            <code className="min-w-0 flex-1 truncate text-sm">{publicUrl}</code>
            {/*
              TODO(connor): judgment call (E3, build-queue.md) — this URL is
              stable and viewed repeatedly (not freshly generated on this
              page load), so this stays a manual copy + toast rather than
              auto-copying every time Settings renders, which would be a
              surprising clipboard side-effect on a page a tutor might just
              be glancing at. Revisit if that reads as too passive in
              practice.
            */}
            <CopyButton value={publicUrl} size="sm" toastMessage="Public page link copied" />
            <ShareButton title="Book with me on Slate" url={publicUrl} />
          </div>
        )}

        <div>
          <Label htmlFor="avatar">Profile photo</Label>
          <div className="flex items-center gap-3">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar preview needs a live blob: URL for the freshly-picked file, which next/image can't optimize
              <img src={avatarPreview} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-sm text-text-tertiary">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <Input id="avatar" name="avatar" type="file" accept="image/*" onChange={onAvatarChange} className="flex-1" />
          </div>
          <FieldHint>Square photos work best. Under 5 MB.</FieldHint>
        </div>

        <div>
          <Label htmlFor="handle">Handle</Label>
          <Input id="handle" name="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="e.g. jane-tutoring" />
          <HandleCheckHint
            handleCheck={handleCheck}
            idleText="Letters, numbers, hyphens, underscores, or periods. Your page lives at /t/your-handle."
          />
        </div>

        <div>
          <Label htmlFor="public_display_name">Display name (optional)</Label>
          <Input
            id="public_display_name"
            name="public_display_name"
            value={publicDisplayName}
            onChange={(e) => setPublicDisplayName(e.target.value)}
            placeholder={tutor.name}
          />
          <FieldHint>Shown on your public page instead of your account name. Leave blank to use &quot;{tutor.name}&quot;.</FieldHint>
        </div>

        <div>
          <Label htmlFor="headline">Headline (optional)</Label>
          <Input
            id="headline"
            name="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. SAT & algebra tutor, 10+ years"
          />
        </div>

        <div>
          <Label htmlFor="bio">Short bio</Label>
          <Textarea id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </div>

        <div>
          <Label htmlFor="subjects">Subjects</Label>
          <Input
            id="subjects"
            name="subjects"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="e.g. Algebra, SAT Prep, Physics"
          />
        </div>

        <div>
          <Label htmlFor="welcome_note">Welcome note (optional)</Label>
          <Textarea
            id="welcome_note"
            name="welcome_note"
            value={welcomeNote}
            onChange={(e) => setWelcomeNote(e.target.value)}
            rows={2}
            placeholder="A short line shown above your services."
          />
        </div>

        <div>
          <Label htmlFor="booking_cta_label">Booking button label</Label>
          <Input
            id="booking_cta_label"
            name="booking_cta_label"
            value={bookingCtaLabel}
            onChange={(e) => setBookingCtaLabel(e.target.value)}
            placeholder="Book"
          />
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_public" defaultChecked={tutor.is_public} className="h-4 w-4 rounded border-border" />
            Publish my page
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="show_bio"
              checked={showBio}
              onChange={(e) => setShowBio(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show my bio
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="show_prices"
              checked={showPrices}
              onChange={(e) => setShowPrices(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show service prices
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="show_phone"
              // checked is gated on hasPhone (not just the local showPhone
              // state) so the two always agree — otherwise, if the phone
              // number gets cleared via the separate settings form on this
              // same page (revalidatePath refreshes this component's props
              // without remounting it, so this state, seeded once at mount,
              // never resyncs on its own), the checkbox could render
              // checked-and-disabled: unclickable, and silently excluded
              // from the next form submission entirely (native HTML never
              // submits a disabled field), flipping show_phone to false in
              // the DB without the tutor ever having touched the checkbox.
              checked={showPhone && hasPhone}
              onChange={(e) => setShowPhone(e.target.checked)}
              disabled={!hasPhone}
              className="h-4 w-4 rounded border-border"
            />
            Show my phone number
          </label>
          {!hasPhone && <FieldHint>Add a phone number in Settings above to enable this.</FieldHint>}
        </div>

        {state.error && <p className="text-sm text-text">{state.error}</p>}
        {state.success && <p className="text-sm text-text-secondary">Saved.</p>}

        <Button type="submit" disabled={pending || handleBlocked}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">Live preview</p>
        <div className="rounded-xl border border-border bg-bg p-6">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- see the form's own avatar preview above
            <img src={avatarPreview} alt="" className="mb-4 h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken text-lg text-text-tertiary">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-xl font-semibold">{displayName}</h2>
          {headline.trim() && <p className="mt-1 text-sm font-medium text-accent">{headline}</p>}
          {subjects.trim() && <p className="mt-1 text-sm text-text-secondary">{subjects}</p>}
          {showBio && bio.trim() && <p className="mt-3 text-sm leading-relaxed text-text">{bio}</p>}
          {welcomeNote.trim() && <p className="mt-3 text-sm text-text-secondary">{welcomeNote}</p>}
          {showPhone && hasPhone && <p className="mt-2 text-sm text-text-secondary">{tutor.phone}</p>}

          <div className="mt-5 space-y-2">
            {services.length === 0 ? (
              <p className="text-sm text-text-secondary">No services listed yet.</p>
            ) : (
              services.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {s.duration_minutes} min{showPrices && s.price_cents != null && ` · ${formatCents(s.price_cents)}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-accent px-3 py-1 text-xs font-medium text-accent-text">
                    {bookingCtaLabel.trim() || "Book"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
