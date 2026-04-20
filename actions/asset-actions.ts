"use server";

import { AssetType, PublishContentType, PublishPlatform } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile, saveUploadedFile } from "@/lib/storage";
import { formBool, formString } from "@/lib/validation";

function syncFlagsForType(type: AssetType) {
  if (type === AssetType.COVER_ART) return { hasCoverArt: true };
  if (type === AssetType.AUDIO_FULL) return { hasFullVersion: true };
  if (type === AssetType.AUDIO_SHORT) return { hasShortVersion: true };
  return {};
}

async function recalcSongAssetFlags(songId: string) {
  const assets = await prisma.asset.findMany({ where: { songId }, select: { type: true } });
  await prisma.song.update({
    where: { id: songId },
    data: {
      hasCoverArt: assets.some((asset) => asset.type === AssetType.COVER_ART),
      hasFullVersion: assets.some((asset) => asset.type === AssetType.AUDIO_FULL),
      hasShortVersion: assets.some((asset) => asset.type === AssetType.AUDIO_SHORT)
    }
  });
}

export async function uploadSongAsset(songId: string, formData: FormData) {
  const type = formString(formData, "type") as AssetType;
  const title = formString(formData, "title") || type.replaceAll("_", " ").toLowerCase();
  const notes = formString(formData, "notes") || null;
  const isPrimary = formBool(formData, "isPrimary");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    redirect(`/songs/${songId}?assetError=missing-file`);
  }

  try {
    const stored = await saveUploadedFile(file, { songId, kind: type });
    if (isPrimary) {
      await prisma.asset.updateMany({ where: { songId, type }, data: { isPrimary: false } });
    }
    await prisma.asset.create({
      data: {
        songId,
        type,
        storageType: "LOCAL",
        title,
        notes,
        isPrimary,
        ...stored
      }
    });
    await prisma.song.update({ where: { id: songId }, data: syncFlagsForType(type) });
  } catch {
    redirect(`/songs/${songId}?assetError=upload-failed`);
  }

  revalidatePath("/");
  revalidatePath("/workflow");
  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}`);
}

export async function attachExternalAsset(songId: string, formData: FormData) {
  const type = formString(formData, "type") as AssetType;
  const title = formString(formData, "title") || type.replaceAll("_", " ").toLowerCase();
  const url = formString(formData, "url");
  const notes = formString(formData, "notes") || null;
  const isPrimary = formBool(formData, "isPrimary");

  if (!url) {
    redirect(`/songs/${songId}?assetError=missing-url`);
  }

  if (isPrimary) {
    await prisma.asset.updateMany({ where: { songId, type }, data: { isPrimary: false } });
  }

  await prisma.asset.create({
    data: {
      songId,
      type,
      storageType: "EXTERNAL_URL",
      title,
      url,
      notes,
      isPrimary
    }
  });
  await prisma.song.update({ where: { id: songId }, data: syncFlagsForType(type) });

  revalidatePath("/");
  revalidatePath("/workflow");
  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}`);
}

export async function deleteAsset(assetId: string) {
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  await deleteStoredFile(asset);
  await prisma.asset.delete({ where: { id: assetId } });
  if (asset.songId) {
    await recalcSongAssetFlags(asset.songId);
    revalidatePath(`/songs/${asset.songId}`);
  }
  revalidatePath("/");
  revalidatePath("/workflow");
  redirect(asset.songId ? `/songs/${asset.songId}` : "/songs");
}

export async function logPublishEvent(songId: string, formData: FormData) {
  const platform = formString(formData, "platform") as PublishPlatform;
  const contentType = formString(formData, "contentType") as PublishContentType;
  const url = formString(formData, "url") || null;
  const notes = formString(formData, "notes") || null;
  const publishedAtRaw = formString(formData, "publishedAt");
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();

  await prisma.publishEvent.create({
    data: { songId, platform, contentType, url, notes, publishedAt }
  });

  if (platform === PublishPlatform.YOUTUBE) {
    await prisma.song.update({ where: { id: songId }, data: { publishedYoutube: true } });
  }
  if (platform === PublishPlatform.WEBSITE) {
    await prisma.song.update({ where: { id: songId }, data: { publishedWebsite: true } });
  }

  revalidatePath("/");
  revalidatePath("/workflow");
  revalidatePath(`/songs/${songId}`);
  redirect(`/songs/${songId}`);
}
