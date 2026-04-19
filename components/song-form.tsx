import type { Playlist, PlaylistSong, Song, Tag } from "@prisma/client";
import { SongStatus } from "@prisma/client";
import { Checkbox, Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type SongWithRelations = Song & { tags: Tag[]; playlistSongs: PlaylistSong[] };

export function SongForm({
  song,
  playlists,
  action,
  submitLabel
}: {
  song?: SongWithRelations;
  playlists: Playlist[];
  action: (formData: FormData) => void;
  submitLabel: string;
}) {
  const playlistIds = new Set(song?.playlistSongs.map((item) => item.playlistId) ?? []);
  const tags = song?.tags.map((tag) => tag.name).join(", ") ?? "";

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Title">
          <input name="title" required defaultValue={song?.title} className={inputClass()} placeholder="Donde duerme tu nombre" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={song?.status ?? "DRAFT"} className={inputClass()}>
            {Object.values(SongStatus).map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mood">
          <input name="mood" defaultValue={song?.mood ?? ""} className={inputClass()} placeholder="Soft melancholy" />
        </Field>
        <Field label="Theme">
          <input name="theme" defaultValue={song?.theme ?? ""} className={inputClass()} placeholder="Mature love" />
        </Field>
        <Field label="Language">
          <select name="language" defaultValue={song?.language ?? "Spanish"} className={inputClass()}>
            <option>Spanish</option>
            <option>English</option>
          </select>
        </Field>
        <Field label="Tags" hint="Comma separated. New tags are created automatically.">
          <input name="tags" defaultValue={tags} className={inputClass()} placeholder="nostalgia, noche, memoria" />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Full lyrics">
          <textarea name="fullLyrics" defaultValue={song?.fullLyrics ?? ""} rows={12} className={inputClass()} />
        </Field>
        <Field label="Suspiro short version">
          <textarea name="shortVersion" defaultValue={song?.shortVersion ?? ""} rows={12} className={inputClass()} />
        </Field>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Hook text">
          <textarea name="hookText" defaultValue={song?.hookText ?? ""} rows={4} className={inputClass()} />
        </Field>
        <Field label="Website excerpt">
          <textarea name="websiteExcerpt" defaultValue={song?.websiteExcerpt ?? ""} rows={4} className={inputClass()} />
        </Field>
        <Field label="YouTube title" hint={`${song?.youtubeTitle?.length ?? 0}/100 characters`}>
          <input name="youtubeTitle" defaultValue={song?.youtubeTitle ?? ""} className={inputClass()} />
        </Field>
        <Field label="YouTube description" hint={`${song?.youtubeDescription?.length ?? 0} characters`}>
          <textarea name="youtubeDescription" defaultValue={song?.youtubeDescription ?? ""} rows={8} className={inputClass()} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea name="notes" defaultValue={song?.notes ?? ""} rows={5} className={inputClass()} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Checkbox name="hasFullVersion" label="Full version" defaultChecked={song?.hasFullVersion} />
        <Checkbox name="hasShortVersion" label="Short version" defaultChecked={song?.hasShortVersion} />
        <Checkbox name="hasCoverArt" label="Cover art" defaultChecked={song?.hasCoverArt} />
        <Checkbox name="publishedYoutube" label="YouTube" defaultChecked={song?.publishedYoutube} />
        <Checkbox name="publishedWebsite" label="Website" defaultChecked={song?.publishedWebsite} />
      </div>

      <div className="rounded-lg border border-white/10 bg-ink/30 p-4">
        <p className="mb-3 text-sm font-medium text-mist">Playlist membership</p>
        <div className="grid gap-2 md:grid-cols-2">
          {playlists.length ? (
            playlists.map((playlist) => (
              <label key={playlist.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-mist/80">
                <input type="checkbox" name="playlistIds" value={playlist.id} defaultChecked={playlistIds.has(playlist.id)} />
                {playlist.title}
              </label>
            ))
          ) : (
            <p className="text-sm text-mist/55">Create a playlist first, then songs can join it here.</p>
          )}
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
