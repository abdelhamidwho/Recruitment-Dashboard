import Link from "next/link";
import { requireUser } from "@/lib/auth/requireUser";
import { PipelineBoard } from "@/components/PipelineBoard";

export default async function JobPipelinePage({ params }: { params: Promise<{ jobId: string }> }) {
  await requireUser();
  const { jobId } = await params;
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link href="/jobs" className="text-sm underline">← All jobs</Link>
      </header>
      <PipelineBoard jobId={jobId} />
    </main>
  );
}
