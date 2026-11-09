import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import { LinkedInImport } from "@/components/LinkedInImport";

export default async function ImportPage() {
  await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <PageHeader title="Import LinkedIn profiles" subtitle={"Free, no scraping on our side: you capture profiles you can already see, we score and store them."} />
      <LinkedInImport />
    </main>
  );
}
