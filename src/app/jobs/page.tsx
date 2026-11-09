import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import { JobsPage } from "@/components/JobsPage";

export default async function Jobs() {
  await requireUser();
  return (
    <main className="min-h-screen bg-background">
      <PageHeader title="Jobs" subtitle={"Create a job, add candidates, and move them through stages."} />
      <JobsPage />
    </main>
  );
}
