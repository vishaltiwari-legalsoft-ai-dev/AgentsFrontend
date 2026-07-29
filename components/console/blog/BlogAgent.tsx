"use client";

export function BlogAgent({ onToast, onBack }: { onToast: (m: string) => void; onBack: () => void }) {
  return (
    <div className="blog-wrap">
      <button onClick={onBack}>Back</button>
      <div className="blog-card">SEO Blog Writer — coming online in Task 11.</div>
    </div>
  );
}
