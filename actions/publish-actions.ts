"use server";

import { PublishContentType, PublishPlatform } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formString } from "@/lib/validation";

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
