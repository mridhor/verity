/** Shown instantly while a page's data loads on the server. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman" className="animate-pulse motion-reduce:animate-none">
      <div className="border-b border-border px-8 pt-7 pb-5">
        <div className="mb-2.5 h-3 w-40 rounded bg-border-soft" />
        <div className="h-7 w-72 rounded bg-border-soft" />
        <div className="mt-3 h-3 w-96 max-w-full rounded bg-border-soft" />
      </div>
      <div className="w-full max-w-[1040px] space-y-4 px-8 py-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[78px] rounded-md border border-border bg-card" />)}
        </div>
        <div className="h-64 rounded-md border border-border bg-card" />
        <div className="h-40 rounded-md border border-border bg-card" />
      </div>
    </div>
  );
}
