import { AssetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/request-url";
import { saveUploadedFile } from "@/lib/storage";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function syncFlagsForType(type: AssetType) {
  if (type === AssetType.COVER_ART) return { hasCoverArt: true };
  if (type === AssetType.AUDIO_FULL) return { hasFullVersion: true };
  if (type === AssetType.AUDIO_SHORT) return { hasShortVersion: true };
  return {};
}

function back(request: NextRequest, songId: string, error?: string) {
  return NextResponse.redirect(publicUrl(request, `/songs/${songId}${error ? `?assetError=${error}` : ""}`), 303);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: songId } = await context.params;
  const formData = await request.formData();
  const mode = value(formData, "mode");
  const type = value(formData, "type") as AssetType;
  const title = value(formData, "title") || type.replaceAll("_", " ").toLowerCase();
  const notes = value(formData, "notes") || null;
  const isPrimary = formData.get("isPrimary") === "on";

  if (!Object.values(AssetType).includes(type)) {
    return back(request, songId, "bad-type");
  }

  try {
    if (isPrimary) {
      await prisma.asset.updateMany({ where: { songId, type }, data: { isPrimary: false } });
    }

    if (mode === "external") {
      const url = value(formData, "url");
      if (!url) return back(request, songId, "missing-url");
      await prisma.asset.create({
        data: { songId, type, storageType: "EXTERNAL_URL", title, url, notes, isPrimary }
      });
    } else {
      const file = formData.get("file");
      if (!(file instanceof File)) return back(request, songId, "missing-file");
      const stored = await saveUploadedFile(file, { songId, kind: type });
      await prisma.asset.create({
        data: { songId, type, storageType: "LOCAL", title, notes, isPrimary, ...stored }
      });
    }

    await prisma.song.update({ where: { id: songId }, data: syncFlagsForType(type) });
  } catch (error) {
    const message = error instanceof Error ? encodeURIComponent(error.message.slice(0, 120)) : "upload-failed";
    return back(request, songId, message || "upload-failed");
  }

  revalidatePath("/");
  revalidatePath("/workflow");
  revalidatePath(`/songs/${songId}`);
  return back(request, songId);
}
