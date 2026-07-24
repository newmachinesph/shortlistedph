"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";
import { cropSquare } from "@/lib/crop";
import { Avatar } from "@/components/avatar";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/** Avatar with an upload affordance. Reusable across talent/employer/etc. */
export function AvatarUpload({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(image);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Photo must be JPEG, PNG, or WebP");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const cropped = await cropSquare(file);
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/api/account/avatar/upload-url",
        { method: "POST", body: JSON.stringify({ contentType: file.type, sizeBytes: cropped.size }) },
      );
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: cropped,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again");
      await api("/api/account/avatar", {
        method: "PATCH",
        body: JSON.stringify({ imageKey: key }),
      });
      setPreview(URL.createObjectURL(cropped));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        aria-label="Change profile photo"
        className="group relative rounded-2xl focus:outline-2 focus:outline-brand disabled:opacity-70"
      >
        <Avatar name={name} image={preview} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/45 opacity-0 transition-opacity group-hover:opacity-100">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Camera className="h-5 w-5 text-white" strokeWidth={1.75} />
          )}
        </span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {error && <p className="max-w-40 text-xs text-ember">{error}</p>}
    </div>
  );
}
