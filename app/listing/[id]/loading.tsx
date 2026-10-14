export default function ListingLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-6 dark:from-black dark:to-zinc-950">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-5 w-24 rounded bg-slate-200 dark:bg-zinc-800" />
        <div className="h-10 w-3/4 rounded bg-slate-200 dark:bg-zinc-800" />
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="aspect-[4/3] rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
            <div className="h-48 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
            <div className="h-16 rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
