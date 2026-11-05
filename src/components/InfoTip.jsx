import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { explain } from '../lib/glossary';

// Small (i) that explains a value in plain words. Hover or focus on desktop, tap on phones.
// A span with role="button" so it can sit inside links and buttons (cards that are clickable).
export function InfoTip({ text, label = 'this', className = '' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const hideTimer = useRef();
  const id = useId();

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(288, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12));
    const below = r.bottom + 8 + 120 < window.innerHeight;
    setPos({ left, width, top: below ? r.bottom + 8 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 8 });
  };
  const show = () => { clearTimeout(hideTimer.current); place(); setOpen(true); };
  const hide = () => { hideTimer.current = setTimeout(() => setOpen(false), 80); };
  // Hover only for a real mouse: on touch screens a tap would otherwise open and then immediately close it.
  const enter = (e) => e.pointerType === 'mouse' && show();
  const leave = (e) => e.pointerType === 'mouse' && hide();

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', () => setOpen(false), { once: true, capture: true });
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', close); };
  }, [open]);

  if (!text) return null;
  const toggle = (e) => { e.preventDefault(); e.stopPropagation(); if (open) setOpen(false); else show(); };
  return (
    <>
      <span ref={ref} role="button" tabIndex={0} aria-label={`What is ${label}?`} aria-describedby={open ? id : undefined}
        onClick={toggle} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(e)}
        onPointerEnter={enter} onPointerLeave={leave} onFocus={(e) => e.target.matches(':focus-visible') && show()} onBlur={hide}
        className={`ml-1 inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-slate-400 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 ${className}`}>
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      {open && pos && createPortal(
        <span id={id} role="tooltip" onPointerEnter={enter} onPointerLeave={leave}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          className="fixed z-[70] animate-fade-in rounded-xl bg-slate-900 px-3 py-2 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl">
          {text}
        </span>,
        document.body,
      )}
    </>
  );
}

// A label that gets an (i) automatically when the glossary knows it. `tip` overrides the glossary;
// `term` looks up a different word than the one shown.
export function Term({ children, tip, term }) {
  const text = tip || explain(term ?? (typeof children === 'string' ? children : ''));
  if (!text) return children ?? null;
  const icon = <InfoTip text={text} label={typeof children === 'string' ? children : term} />;
  if (typeof children !== 'string') return <span>{children}{icon}</span>;
  // Keep the (i) on the same line as the last word, so it never wraps onto a line by itself.
  const cut = children.trimEnd().lastIndexOf(' ') + 1;
  return <span>{children.slice(0, cut)}<span className="whitespace-nowrap">{children.slice(cut)}{icon}</span></span>;
}
