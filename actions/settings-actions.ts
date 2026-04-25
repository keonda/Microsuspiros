"use server";

import { PublishPlatform } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appConfig } from "@/lib/config";
import { dashboardPresetSections, dashboardSectionIds, type DashboardPreset } from "@/lib/dashboard-preferences";
import { syncAnalyticsSnapshotForEvent } from "@/lib/integrations/youtube-analytics";
import { prisma } from "@/lib/prisma";
import { formString, formStringArray } from "@/lib/validation";

function toDateOrNow(value: string) {
  return value ? new Date(value) : new Date();
}

function toInt(value: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value: string) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveDashboardPreferences(formData: FormData) {
  const requestedPreset = formString(formData, "preset").toLowerCase();
  const preset = (["full", "content", "release", "minimal"].includes(requestedPreset) ? requestedPreset : appConfig().dashboardDefaultPreset) as DashboardPreset;
  const enabledSections = formStringArray(formData, "enabledSections").filter((section): section is (typeof dashboardSectionIds)[number] =>
    dashboardSectionIds.includes(section as (typeof dashboardSectionIds)[number])
  );
  const collapsedSections = formStringArray(formData, "collapsedSections").filter((section): section is (typeof dashboardSectionIds)[number] =>
    dashboardSectionIds.includes(section as (typeof dashboardSectionIds)[number])
  );

  await prisma.userPreference.upsert({
    where: { key: "dashboard" },
    update: {
      value: {
        preset,
        compact: formString(formData, "compact") === "true",
        enabledSections: enabledSections.length ? enabledSections : dashboardPresetSections(preset),
        collapsedSections
      }
    },
    create: {
      key: "dashboard",
      value: {
        preset,
        compact: formString(formData, "compact") === "true",
        enabledSections: enabledSections.length ? enabledSections : dashboardPresetSections(preset),
        collapsedSections
      }
    }
  });

  revalidatePath("/");
  redirect("/");
}

export async function createAnalyticsSnapshot(songId: string, formData: FormData) {
  const selectedPublishEventId = formString(formData, "publishEventId") || null;
  const platform = (formString(formData, "platform") as PublishPlatform) || PublishPlatform.OTHER;
  const snapshotDate = toDateOrNow(formString(formData, "snapshotDate"));
  const views = toInt(formString(formData, "views"));
  const likes = toInt(formString(formData, "likes"));
  const comments = toInt(formString(formData, "comments"));
  const shares = toInt(formString(formData, "shares"));
  const watchTime = toInt(formString(formData, "watchTime"));
  const ctr = toFloat(formString(formData, "ctr"));
  const retention = toFloat(formString(formData, "retention"));
  const fieldsAreEmpty =
    views === null &&
    likes === null &&
    comments === null &&
    shares === null &&
    watchTime === null &&
    ctr === null &&
    retention === null;

  let publishEventId = selectedPublishEventId;
  if (platform === PublishPlatform.YOUTUBE && !publishEventId && fieldsAreEmpty) {
    const fallbackYoutubeEvent = await prisma.publishEvent.findFirst({
      where: {
        songId,
        platform: PublishPlatform.YOUTUBE,
        OR: [
          { externalId: { not: null } },
          { externalUrl: { not: null } },
          { url: { not: null } }
        ]
      },
      orderBy: { publishedAt: "desc" }
    });
    publishEventId = fallbackYoutubeEvent?.id || null;
  }

  const shouldAutoImportYoutube =
    platform === PublishPlatform.YOUTUBE &&
    Boolean(publishEventId) &&
    appConfig().analyticsImportEnabled &&
    fieldsAreEmpty;

  if (publishEventId && shouldAutoImportYoutube) {
    try {
      await syncAnalyticsSnapshotForEvent(songId, publishEventId, snapshotDate);
      revalidatePath("/");
      revalidatePath(`/songs/${songId}`);
      redirect(`/songs/${songId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import YouTube analytics.";
      redirect(`/songs/${songId}?analyticsError=${encodeURIComponent(message.slice(0, 180))}`);
    }
  }

  if (platform === PublishPlatform.YOUTUBE && fieldsAreEmpty) {
    redirect(`/songs/${songId}?analyticsError=${encodeURIComponent("Choose a synced YouTube publish event first, or enter metrics manually.")}`);
  }

  await prisma.analyticsSnapshot.create({
    data: {
      songId,
      publishEventId,
      platform,
      snapshotDate,
      views,
      likes,
      comments,
      shares,
      watchTime,
      ctr,
      retention
    }
  });

  revalidatePath("/");
  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}`);
}
