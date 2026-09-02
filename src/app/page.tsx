import { SearchBuilder } from "@/components/SearchBuilder";
import skills from "@/data/skills.json";
import rolePresets from "@/data/rolePresets.json";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">HR Sourcing Dashboard</h1>
        <p className="text-muted-foreground text-sm">Build searches, find candidates, and manage shortlists.</p>
      </header>
      <SearchBuilder skillsTaxonomy={skills} rolePresets={rolePresets} />
    </main>
  );
}
