"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";
import { Avatar } from "@/components/avatar";
import { Field, TextArea, TextInput } from "@/components/onboarding-fields";

export function ProfileForm({
  employer,
  logoUrl,
  email,
}: {
  employer: {
    companyName: string;
    location: string | null;
    contactName: string | null;
    blurb: string | null;
  };
  logoUrl: string | null;
  email: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState(employer.companyName);
  const [location, setLocation] = useState(employer.location ?? "");
  const [contactName, setContactName] = useState(employer.contactName ?? "");
  const [blurb, setBlurb] = useState(employer.blurb ?? "");
  const [preview, setPreview] = useState(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Center-crop to a 512px square. PNG keeps transparency; others re-encode as-is. */
  async function cropSquare(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    bitmap.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image"))),
        file.type,
        0.9,
      );
    });
  }

  async function handleFile(file: File) {
    setError(null);
    setSaved(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Logo must be JPEG, PNG, or WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const cropped = await cropSquare(file);
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/api/employer/logo/upload-url",
        {
          method: "POST",
          body: JSON.stringify({ contentType: file.type, sizeBytes: cropped.size }),
        },
      );
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: cropped,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again");
      await api("/api/employer/profile", {
        method: "PATCH",
        body: JSON.stringify({ logoKey: key }),
      });
      setPreview(URL.createObjectURL(cropped));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    setBusy(true);
    try {
      await api("/api/employer/profile", {
        method: "PATCH",
        body: JSON.stringify({
          companyName: companyName.trim(),
          location: location.trim(),
          contactName: contactName.trim(),
          blurb: blurb.trim(),
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7 rounded-2xl border border-line bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-start gap-5">
        <Avatar name={companyName} image={preview} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-ink">{companyName}</h2>
          <p className="mt-1 text-sm text-ink-soft">{email}</p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <ImageUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {uploading ? "Uploading…" : preview ? "Replace logo" : "Upload logo"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-7 grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
        <Field label="Company name" htmlFor="companyName">
          <TextInput id="companyName" value={companyName} onChange={setCompanyName} />
        </Field>
        <Field label="Location" htmlFor="location">
          <TextInput id="location" value={location} onChange={setLocation} placeholder="e.g. Makati, PH" />
        </Field>
        <Field label="Contact" htmlFor="contactName">
          <TextInput id="contactName" value={contactName} onChange={setContactName} placeholder="Who talks to candidates" />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="About"
            htmlFor="blurb"
            hint="A short description candidates see before accepting a connection."
          >
            <TextArea id="blurb" value={blurb} onChange={setBlurb} rows={4} />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || uploading}
          onClick={save}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
          {busy ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-ink-faint">Saved.</span>}
        {error && <span className="text-sm text-ember">{error}</span>}
      </div>
    </div>
  );
}
