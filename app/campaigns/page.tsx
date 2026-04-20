import Link from "next/link";
import { ReleaseCampaignStatus } from "@prisma/client";
import { PageHeading } from "@/components/page-heading";
import { Card, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { dateLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await prisma.releaseCampaign.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true, scheduledReleases: true } } }
  });

  return (
    <>
      <PageHeading
        title="Campaigns"
        subtitle="Release arcs for songs, shorts, playlist drops, and website pushes."
        action={<Link href="/campaigns/new" className="rounded-lg bg-rose px-4 py-2 text-sm font-semibold text-ink">New Campaign</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {campaigns.length ? campaigns.map((campaign) => (
          <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-soft hover:bg-white/9">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-gold">{campaign.goal.replaceAll("_", " ")}</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{campaign.title}</h2>
                <p className="mt-2 text-sm text-mist/60">{campaign.description || "No description yet."}</p>
              </div>
              <CampaignBadge status={campaign.status} />
            </div>
            <p className="mt-4 text-sm text-mist/55">{campaign._count.items} items - {campaign._count.scheduledReleases} scheduled - updated {dateLabel(campaign.updatedAt)}</p>
          </Link>
        )) : (
          <Card>
            <CardTitle title="No Campaigns Yet" />
            <p className="text-sm text-mist/65">Create a release arc for a song launch, shorts push, or emotional theme set.</p>
          </Card>
        )}
      </div>
    </>
  );
}

function CampaignBadge({ status }: { status: ReleaseCampaignStatus }) {
  return <span className="rounded-full bg-rose/15 px-3 py-1 text-xs font-semibold text-rose ring-1 ring-rose/25">{status.replaceAll("_", " ")}</span>;
}
