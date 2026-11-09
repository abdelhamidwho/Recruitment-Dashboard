import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/PageHeader";
import { PipelineBoard } from "@/components/PipelineBoard";

export default async function JobPipelinePage({ params }: { params: Promise<{ jobId: string }> }) {
  await requireUser();
  const { jobId } = await params;
  return (
    <main className="min-h-screen bg-background">
      <>
        <PageHeader />
        <Link href="/jobs" className="lux-nav-link mx-6 mt-4 inline-block"><ArrowLeft aria-hidden />All jobs</Link>
      </>
      <PipelineBoard jobId={jobId} />
    </main>
  );
}
