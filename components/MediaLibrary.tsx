"use client";

import { useState } from "react";

type Media = { id: string; originalName: string; mimeType: string; sizeBytes: number; url: string };

export function MediaLibrary({ initialFiles }: { initialFiles: Media[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [message, setMessage] = useState("");

  async function upload(formData: FormData) {
    setMessage("Uploading...");
    const response = await fetch("/api/media", { method: "POST", body: formData });
    const data = await response.json();
    setMessage(response.ok ? "Uploaded." : data.error);
    if (response.ok) setFiles((current) => [data.media, ...current]);
  }

  return (
    <section className="mt-6">
      <form action={upload} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <input name="file" type="file" className="block w-full text-sm" />
        <button className="mt-4 rounded-md bg-ink px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-950">Upload</button>
        {message ? <p className="mt-3 text-sm text-zinc-500">{message}</p> : null}
      </form>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {files.map((file) => (
          <article key={file.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="truncate font-medium">{file.originalName}</p>
            <p className="mb-3 text-xs text-zinc-500">{file.mimeType} · {(file.sizeBytes / 1024).toFixed(1)} KB</p>
            {file.mimeType.startsWith("image/") ? <img src={file.url} alt={file.originalName} className="max-h-64 rounded-md object-contain" /> : null}
            {file.mimeType.startsWith("video/") ? <video src={file.url} controls className="max-h-64 w-full rounded-md" /> : null}
            {file.mimeType.startsWith("audio/") ? <audio src={file.url} controls className="w-full" /> : null}
            {file.mimeType === "application/pdf" ? <a className="text-clay dark:text-amber-300" href={file.url} target="_blank">Open PDF</a> : null}
            <code className="mt-3 block rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-950">![{file.originalName}]({file.url})</code>
          </article>
        ))}
      </div>
    </section>
  );
}
