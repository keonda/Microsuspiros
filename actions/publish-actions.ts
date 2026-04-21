"use server";

import { ExternalSyncStatus, PublishContentType, PublishPlatform } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildSongExportPackets } from "@/lib/export-packets";
import { prisma } from "@/lib/prisma";
import { syncWebsitePublish } from "@/lib/integrations/website";
import { syncYoutubePublish } from "@/lib/integrations/youtube";
import { formString } from "@/lib/validation";

export async function logPublishEvent(songId: string, formData: FormData) {
  const platform = formString(formData, "platform") as PublishPlatform;
  const contentType = formString(formData, "contentType") as PublishContentType;
  const url = formString(formData, "url") || null;
  const notes = formString(formData, "notes") || null;
  const publishedAtRaw = formString(formData, "publishedAt");
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
  let sync: {
    syncStatus: ExternalSyncStatus;
    externalId: string | null;
    externalUrl: string | null;
    thumbnailUrl: string | null;
    syncError: string | null;
  } = {
    syncStatus: ExternalSyncStatus.NONE,
    externalId: null as string | null,
    externalUrl: url,
    thumbnailUrl: null as string | null,
    syncError: null as string | null
  };

  if (platform === PublishPlatform.YOUTUBE) {
    const result = await syncYoutubePublish(url);
    sync = {
      syncStatus: result.syncStatus,
      externalId: result.externalId || null,
      externalUrl: result.externalUrl || url,
      thumbnailUrl: result.thumbnailUrl || null,
      syncError: result.syncError || null
    };
  }

  if (platform === PublishPlatform.WEBSITE) {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { tags: true, assets: true, scheduledReleases: true, campaignItems: { include: { campaign: true } } }
    });
    const payload = song ? buildSongExportPackets(song).websitePacket : undefined;
    const result = await syncWebsitePublish(url, payload);
    sync = {
      syncStatus: result.syncStatus,
      externalId: result.externalId || null,
      externalUrl: result.externalUrl || url,
      thumbnailUrl: null,
      syncError: result.syncError || null
    };
  }

  await prisma.publishEvent.create({
    data: {
      songId,
      platform,
      contentType,
      url,
      externalUrl: sync.externalUrl,
      externalId: sync.externalId,
      thumbnailUrl: sync.thumbnailUrl,
      syncStatus: sync.syncStatus,
      syncError: sync.syncError,
      lastSyncedAt: sync.syncStatus === ExternalSyncStatus.SYNCED ? new Date() : null,
      notes,
      publishedAt
    }
  });

  if (platform === PublishPlatform.YOUTUBE) {
    await prisma.song.update({ where: { id: songId }, data: { publishedYoutube: true } });
  }
  if (platform === PublishPlatform.WEBSITE) {
    await prisma.song.update({ where: { id: songId }, data: { publishedWebsite: true } });
  }

  revalidatePath("/");
  revalidatePath("/workflow");
  revalidatePath("/integrations");
  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}`);
}

export async function syncPublishEvent(eventId: string) {
  const event = await prisma.publishEvent.findUnique({
    where: { id: eventId },
    include: {
      song: {
        include: {
          tags: true,
          assets: true,
          scheduledReleases: true,
          campaignItems: { include: { campaign: true } }
        }
      }
    }
  });
  if (!event) return;

  let result: {
    syncStatus: ExternalSyncStatus;
    externalId: string | null;
    externalUrl: string | null;
    thumbnailUrl: string | null;
    syncError: string | null;
  } = {
    syncStatus: ExternalSyncStatus.NONE,
    externalId: event.externalId,
    externalUrl: event.externalUrl || event.url,
    thumbnailUrl: event.thumbnailUrl,
    syncError: null as string | null
  };

  if (event.platform === PublishPlatform.YOUTUBE) {
    result = { ...result, ...(await syncYoutubePublish(event.externalUrl || event.url || event.externalId)) };
  } else if (event.platform === PublishPlatform.WEBSITE) {
    const payload = event.song ? buildSongExportPackets(event.song).websitePacket : undefined;
    result = { ...result, ...(await syncWebsitePublish(event.externalUrl || event.url, payload)) };
  }

  await prisma.publishEvent.update({
    where: { id: eventId },
    data: {
      externalId: result.externalId || null,
      externalUrl: result.externalUrl || event.url,
      thumbnailUrl: result.thumbnailUrl || null,
      syncStatus: result.syncStatus,
      syncError: result.syncError || null,
      lastSyncedAt: new Date()
    }
  });

  revalidatePath("/");
  revalidatePath("/integrations");
  revalidatePath(`/songs/${event.songId}`);
  redirect(`/songs/${event.songId}`);
}
