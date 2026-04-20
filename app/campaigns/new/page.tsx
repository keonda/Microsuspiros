import { ReleaseCampaignGoal, ReleaseCampaignStatus } from "@prisma/client";
import { createCampaign } from "@/actions/release-actions";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";

export default function NewCampaignPage() {
  return (
    <>
      <PageHeading title="New Campaign" subtitle="Shape a release arc before the songs go out into the world." />
      <Card>
        <form action={createCampaign} className="grid gap-4 md:grid-cols-2">
          <input name="title" required className={inputClass()} placeholder="Late-night memory arc" />
          <select name="status" className={inputClass()} defaultValue={ReleaseCampaignStatus.PLANNING}>
            {Object.values(ReleaseCampaignStatus).map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select name="goal" className={inputClass()} defaultValue={ReleaseCampaignGoal.MIXED}>
            {Object.values(ReleaseCampaignGoal).map((goal) => <option key={goal} value={goal}>{goal.replaceAll("_", " ")}</option>)}
          </select>
          <input name="startDate" type="date" className={inputClass()} />
          <input name="endDate" type="date" className={inputClass()} />
          <textarea name="description" rows={4} className={inputClass("md:col-span-2")} placeholder="Campaign description" />
          <textarea name="notes" rows={4} className={inputClass("md:col-span-2")} placeholder="Notes" />
          <Button type="submit">Create campaign</Button>
        </form>
      </Card>
    </>
  );
}
