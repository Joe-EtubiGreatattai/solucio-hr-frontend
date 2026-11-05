// Solucio mark: white cross in a brand-teal rounded square.
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-700 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-3/5 w-3/5" aria-hidden="true"><path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff" /></svg>
    </span>
  );
}
