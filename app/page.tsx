// TODO(M1): move copy to messages/ (PR 2) and use core components (PR 3).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-h1">ListenLoop</h1>
      <p className="text-ink-muted">
        7-day English listening practice. Coming soon.
      </p>
    </main>
  );
}
