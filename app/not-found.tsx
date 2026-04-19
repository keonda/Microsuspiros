import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <>
      <PageHeading title="Not found" subtitle="That page slipped out like a breath in the dark." />
      <Card>
        <Link href="/" className="text-rose hover:text-rose/80">Return to dashboard</Link>
      </Card>
    </>
  );
}
