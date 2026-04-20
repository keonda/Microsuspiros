import { AssetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/request-url";
import { deleteStoredFile } from "@/lib/storage";

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

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id } });
  await deleteStoredFile(asset);
  await prisma.asset.delete({ where: { id } });

  if (asset.songId) {
    await recalcSongAssetFlags(asset.songId);
    revalidatePath(`/songs/${asset.songId}`);
  }
  revalidatePath("/");
  revalidatePath("/workflow");

  return NextResponse.redirect(publicUrl(request, asset.songId ? `/songs/${asset.songId}` : "/songs"), 303);
}
