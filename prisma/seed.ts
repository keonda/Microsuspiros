import { PrismaClient, SongStatus } from "@prisma/client";
import { slugify } from "../lib/slug";

const prisma = new PrismaClient();

async function main() {
  await prisma.aIGenerationLog.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.playlistSong.deleteMany();
  await prisma.song.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.tag.deleteMany();

  const tags = await Promise.all(
    ["nostalgia", "amor maduro", "memoria", "noche", "duelo suave", "suspiro", "reencuentro"].map((name) =>
      prisma.tag.create({ data: { name, slug: slugify(name) } })
    )
  );

  const tagByName = new Map(tags.map((tag) => [tag.name, tag]));

  const songs = await Promise.all([
    prisma.song.create({
      data: {
        title: "Donde Duerme Tu Nombre",
        slug: "donde-duerme-tu-nombre",
        status: SongStatus.IN_PROGRESS,
        mood: "Soft melancholy",
        theme: "Mature love",
        language: "Spanish",
        fullLyrics:
          "Guarde tu nombre donde no llega el ruido,\nentre la taza tibia y la tarde sin prisa.\nNo lo digo para que vuelva,\nlo digo para que no se me vuelva piedra.",
        shortVersion: "Guarde tu nombre en un lugar sin ruido, no para llamarte, sino para seguir siendo suave.",
        hookText: "Un amor que ya no pide regreso, solo permiso para quedarse tierno.",
        youtubeTitle: "Donde Duerme Tu Nombre | MicroSuspiros",
        websiteExcerpt: "Una pieza breve sobre el amor que madura despues de la despedida.",
        notes: "Works well as a slow short with warm piano.",
        hasFullVersion: true,
        hasShortVersion: true,
        hasCoverArt: false,
        tags: { connect: [{ id: tagByName.get("amor maduro")!.id }, { id: tagByName.get("memoria")!.id }] }
      }
    }),
    prisma.song.create({
      data: {
        title: "La Casa De Ayer",
        slug: "la-casa-de-ayer",
        status: SongStatus.READY,
        mood: "Nostalgic",
        theme: "Memory",
        language: "Spanish",
        fullLyrics:
          "La casa de ayer no tenia paredes,\ntenia el olor de tu risa en la puerta.\nVolvi sin tocar nada,\npor miedo a despertar lo que ya descansa.",
        shortVersion: "Volvi a la casa de ayer y no toque nada. Hay recuerdos que tambien merecen dormir.",
        hookText: "Una visita pequena a los lugares que seguimos llevando dentro.",
        youtubeTitle: "La Casa De Ayer - MicroSuspiros",
        youtubeDescription:
          "Volvi a la casa de ayer y no toque nada.\n\nUn MicroSuspiro sobre memoria, regreso y ternura.",
        websiteExcerpt: "Un suspiro para los lugares que existen mas claros en la memoria que en la calle.",
        hasFullVersion: true,
        hasShortVersion: true,
        hasCoverArt: true,
        publishedYoutube: false,
        tags: { connect: [{ id: tagByName.get("nostalgia")!.id }, { id: tagByName.get("memoria")!.id }] }
      }
    }),
    prisma.song.create({
      data: {
        title: "Cuando Pase La Lluvia",
        slug: "cuando-pase-la-lluvia",
        status: SongStatus.DRAFT,
        mood: "Tender longing",
        theme: "Heartbreak",
        language: "Spanish",
        fullLyrics:
          "Cuando pase la lluvia,\nno prometo estar seco.\nHay despedidas que mojan por dentro\ny aun asi nos ensenan a cuidar el fuego.",
        shortVersion: "Cuando pase la lluvia, tal vez siga mojado por dentro. Pero voy a cuidar el fuego.",
        hookText: "Desamor sin rabia, con una pequena luz al fondo.",
        hasFullVersion: true,
        hasShortVersion: true,
        hasCoverArt: false,
        tags: { connect: [{ id: tagByName.get("duelo suave")!.id }, { id: tagByName.get("noche")!.id }] }
      }
    }),
    prisma.song.create({
      data: {
        title: "Carta Sin Enviar",
        slug: "carta-sin-enviar",
        status: SongStatus.PUBLISHED,
        mood: "Quiet",
        theme: "Longing",
        language: "Spanish",
        fullLyrics:
          "Escribi una carta sin direccion,\nno porque no supiera encontrarte,\nsino porque al fin entendi\nque algunas palabras solo necesitan salir de mi.",
        shortVersion: "Escribi una carta sin direccion. Algunas palabras no buscan destino, buscan descanso.",
        hookText: "Una despedida amable para lo que nunca se dijo.",
        youtubeTitle: "Carta Sin Enviar | MicroSuspiros",
        youtubeDescription: "Una despedida amable para lo que nunca se dijo.\n\nMicroSuspiros: canciones pequenas para emociones grandes.",
        websiteExcerpt: "Una cancion breve sobre soltar palabras que ya pesaban demasiado.",
        hasFullVersion: true,
        hasShortVersion: true,
        hasCoverArt: true,
        publishedYoutube: true,
        publishedWebsite: true,
        tags: { connect: [{ id: tagByName.get("suspiro")!.id }, { id: tagByName.get("noche")!.id }] }
      }
    })
  ]);

  const playlistA = await prisma.playlist.create({
    data: {
      title: "Amores Que Se Quedan Suaves",
      slug: "amores-que-se-quedan-suaves",
      type: "COMPILATION",
      description: "Canciones sobre amor maduro, memoria y despedidas sin filo."
    }
  });

  const playlistB = await prisma.playlist.create({
    data: {
      title: "Shorts Para La Noche",
      slug: "shorts-para-la-noche",
      type: "SHORTS_SET",
      description: "Suspiros breves para publicar como shorts de tono intimo."
    }
  });

  await prisma.playlistSong.createMany({
    data: [
      { playlistId: playlistA.id, songId: songs[0].id, position: 1 },
      { playlistId: playlistA.id, songId: songs[1].id, position: 2 },
      { playlistId: playlistA.id, songId: songs[3].id, position: 3 },
      { playlistId: playlistB.id, songId: songs[2].id, position: 1 },
      { playlistId: playlistB.id, songId: songs[3].id, position: 2 }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
