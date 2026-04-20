"use server";

import { CampaignItemType, PublishContentType, PublishPlatform, ReleaseCampaignGoal, ReleaseCampaignStatus, ScheduledReleaseStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { formString, formStringArray } from "@/lib/validation";

function dateOrNull(value: string) {
  return value ? new Date(value) : null;
}

export async function createCampaign(formData: FormData) {
  const title = formString(formData, "title");
  const slug = await uniqueSlug(title, async (candidate) => Boolean(await prisma.releaseCampaign.findUnique({ where: { slug: candidate } })));
  const campaign = await prisma.releaseCampaign.create({
    data: {
      title,
      slug,
      description: formString(formData, "description") || null,
      status: formString(formData, "status") as ReleaseCampaignStatus,
      goal: formString(formData, "goal") as ReleaseCampaignGoal,
      startDate: dateOrNull(formString(formData, "startDate")),
      endDate: dateOrNull(formString(formData, "endDate")),
      notes: formString(formData, "notes") || null
    }
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaign(id: string, formData: FormData) {
  const title = formString(formData, "title");
  const current = await prisma.releaseCampaign.findUniqueOrThrow({ where: { id }, select: { title: true, slug: true } });
  const slug = current.title === title ? current.slug : await uniqueSlug(title, async (candidate) => Boolean(await prisma.releaseCampaign.findFirst({ where: { slug: candidate, NOT: { id } } })));
  await prisma.releaseCampaign.update({
    where: { id },
    data: {
      title,
      slug,
      description: formString(formData, "description") || null,
      status: formString(formData, "status") as ReleaseCampaignStatus,
      goal: formString(formData, "goal") as ReleaseCampaignGoal,
      startDate: dateOrNull(formString(formData, "startDate")),
      endDate: dateOrNull(formString(formData, "endDate")),
      notes: formString(formData, "notes") || null
    }
  });
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
}

export async function addCampaignItem(campaignId: string, formData: FormData) {
  const songId = formString(formData, "songId") || null;
  const playlistId = formString(formData, "playlistId") || null;
  await prisma.campaignItem.create({
    data: {
      campaignId,
      songId,
      playlistId,
      itemType: formString(formData, "itemType") as CampaignItemType,
      title: formString(formData, "title") || null,
      notes: formString(formData, "notes") || null,
      priority: Number(formString(formData, "priority")) || 0
    }
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/queue");
}

export async function assignSongToCampaign(songId: string, formData: FormData) {
  const campaignId = formString(formData, "campaignId");
  if (!campaignId) redirect(`/songs/${songId}`);

  await prisma.campaignItem.create({
    data: {
      campaignId,
      songId,
      itemType: (formString(formData, "itemType") as CampaignItemType) || "SONG",
      notes: formString(formData, "notes") || null,
      priority: Number(formString(formData, "priority")) || 0
    }
  });
  revalidatePath(`/songs/${songId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/queue");
  redirect(`/songs/${songId}`);
}

export async function assignPlaylistToCampaign(playlistId: string, formData: FormData) {
  const campaignId = formString(formData, "campaignId");
  if (!campaignId) redirect(`/playlists/${playlistId}`);

  await prisma.campaignItem.create({
    data: {
      campaignId,
      playlistId,
      itemType: "PLAYLIST",
      notes: formString(formData, "notes") || null,
      priority: Number(formString(formData, "priority")) || 0
    }
  });
  revalidatePath(`/playlists/${playlistId}`);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/queue");
  redirect(`/playlists/${playlistId}`);
}

export async function scheduleRelease(formData: FormData) {
  const songId = formString(formData, "songId") || null;
  const playlistId = formString(formData, "playlistId") || null;
  const campaignId = formString(formData, "campaignId") || null;
  const title = formString(formData, "title") || "Untitled release";
  const release = await prisma.scheduledRelease.create({
    data: {
      songId,
      playlistId,
      campaignId,
      title,
      platform: formString(formData, "platform") as PublishPlatform,
      contentType: formString(formData, "contentType") as PublishContentType,
      status: formString(formData, "status") as ScheduledReleaseStatus,
      scheduledFor: dateOrNull(formString(formData, "scheduledFor")),
      notes: formString(formData, "notes") || null,
      ctaText: formString(formData, "ctaText") || null,
      url: formString(formData, "url") || null
    }
  });
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/queue");
  if (songId) revalidatePath(`/songs/${songId}`);
  if (playlistId) revalidatePath(`/playlists/${playlistId}`);
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
  redirect(release.songId ? `/songs/${release.songId}` : "/calendar");
}

export async function markScheduledReleasePublished(id: string) {
  const release = await prisma.scheduledRelease.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() }
  });
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/queue");
  if (release.songId) revalidatePath(`/songs/${release.songId}`);
}

export async function bulkQueueAction(formData: FormData) {
  const ids = formStringArray(formData, "songIds");
  const action = formString(formData, "bulkAction");
  const campaignId = formString(formData, "campaignId");
  if (!ids.length) redirect("/queue");

  if (action === "READY") {
    await prisma.song.updateMany({ where: { id: { in: ids } }, data: { status: "READY" } });
  }
  if (action === "ARCHIVED") {
    await prisma.song.updateMany({ where: { id: { in: ids } }, data: { status: "ARCHIVED" } });
  }
  if (action === "ADD_TO_CAMPAIGN" && campaignId) {
    await prisma.$transaction(ids.map((songId) => prisma.campaignItem.create({ data: { campaignId, songId, itemType: "SONG" } })));
  }
  if (action === "SCHEDULE_SHORTS") {
    await prisma.$transaction(
      ids.map((songId, index) =>
        prisma.scheduledRelease.create({
          data: {
            songId,
            title: `Short release ${index + 1}`,
            platform: "YOUTUBE",
            contentType: "SHORT",
            status: "PLANNED"
          }
        })
      )
    );
  }

  revalidatePath("/queue");
  revalidatePath("/calendar");
  redirect("/queue");
}
