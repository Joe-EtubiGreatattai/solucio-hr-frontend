import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCountUp, useExit } from '../lib/motion';
import { Loader2, X, Inbox, Eye, EyeOff } from 'lucide-react';
import { titleCase } from '../lib/format';
import { Term } from './InfoTip';

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, ...props }) {
  const variants = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  };
  // Phones get at least a 40px touch height; desktop keeps the compact sizes.
  const sizes = { sm: 'min-h-10 px-3.5 py-1.5 text-sm desk:min-h-0 desk:px-3 desk:text-xs', md: 'min-h-11 px-5 py-2.5 text-sm desk:min-h-0', lg: 'px-6 py-3 text-base' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ title, action, className = '', bodyClass = 'p-5', children }) {
  return (
    <div className={`card ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <h3 className="text-[17px] font-semibold text-slate-900">{typeof title === 'string' ? <Term>{title}</Term> : title}</h3>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
    </div>
  );
}

const BADGE_COLORS = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  teal: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};

const STATUS_COLOR = {
  approved: 'green', verified: 'green', on_time: 'green', valid: 'green', published: 'green', completed: 'green',
  resolved: 'green', fulfilled: 'green', active: 'green', on_duty: 'green', actioned: 'green', no_expiry: 'teal',
  pending: 'amber', expiring_soon: 'amber', late: 'amber', draft: 'slate', open: 'blue', under_review: 'blue',
  on_duty_late: 'amber', upcoming: 'slate', new: 'blue', reviewed: 'teal', important: 'amber', on_leave: 'purple',
  rejected: 'red', expired: 'red', absent: 'red', missing: 'red', cancelled: 'slate', dismissed: 'slate',
  urgent: 'red', inactive: 'slate', suspended: 'red', unscheduled: 'purple', normal: 'slate',
};

export function Badge({ children, color, status }) {
  const c = color || STATUS_COLOR[status] || 'slate';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_COLORS[c]}`}>
      {children ?? titleCase(status)}
    </span>
  );
}

const fieldValue = (f) => (f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value);

// Only the top-most open dialog reacts to Escape / Tab.
const dialogStack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog. Closing it by Escape, the X or a click outside asks before throwing away unsaved
// changes: a field counts as changed only while its value differs from when it was first touched, and
// submitting or pressing a save button commits the current values. Footer buttons call onClose directly.
export function Modal({ open, onClose, title, children, footer, size = 'md', guardChanges = true }) {
  const panel = useRef(null);
  const baseline = useRef(new Map()); // field -> value when first touched
  const [askDiscard, setAskDiscard] = useState(false);
  const titleId = useId();
  const { mounted, closing } = useExit(open, 160);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const requestClose = () => {
    const changed = [...baseline.current].some(([f, v]) => f.isConnected && fieldValue(f) !== v);
    if (guardChanges && changed) setAskDiscard(true);
    else closeRef.current();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!open) return;
    baseline.current = new Map();
    setAskDiscard(false);
    const id = Symbol('dialog');
    dialogStack.push(id);
    const previouslyFocused = document.activeElement;
    const el = panel.current;
    // Focus the first form field, else the first button in the body/footer.
    const first = el.querySelector('input:not([type="hidden"]), select, textarea') || el.querySelector(`.dialog-body ${FOCUSABLE}, .dialog-footer ${FOCUSABLE}`);
    (first || el).focus();

    const onKey = (e) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (e.key === 'Escape') { e.preventDefault(); requestCloseRef.current(); }
      if (e.key === 'Tab') {
        const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const [firstItem, lastItem] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus(); }
        else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus(); }
      }
    };
    const touch = (e) => {
      const f = e.target.closest?.('input, select, textarea');
      if (f && !baseline.current.has(f)) baseline.current.set(f, fieldValue(f));
    };
    // Saved: whatever is in the fields now is the new starting point.
    const commit = () => setTimeout(() => { for (const f of baseline.current.keys()) baseline.current.set(f, fieldValue(f)); });
    const onClick = (e) => {
      const b = e.target.closest?.('button');
      // A save: a button inside a form or tied to one, or a footer action. Not "Keep editing" and the like.
      if (b && (b.form || b.closest('.dialog-footer'))) commit();
    };
    window.addEventListener('keydown', onKey);
    el.addEventListener('focusin', touch);
    el.addEventListener('pointerdown', touch, true);
    el.addEventListener('submit', commit, true);
    el.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('focusin', touch);
      el.removeEventListener('pointerdown', touch, true);
      el.removeEventListener('submit', commit, true);
      el.removeEventListener('click', onClick, true);
      dialogStack.splice(dialogStack.indexOf(id), 1);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  // Portalled to <body> so no ancestor (transforms, filters, overflow) can trap or clip the dialog.
  return createPortal(
    // Phones: a bottom sheet anchored to the screen edge. Larger screens: a centred dialog.
    <div className={`fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-sm sm:items-start sm:p-4 sm:pt-[8vh] ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}
      onMouseDown={requestClose}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`card w-full rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-xl outline-none sm:rounded-b-2xl sm:pb-0 ${widths[size]} ${closing ? 'animate-[sheet-down_0.2s_ease-in_both] sm:animate-scale-out' : 'animate-[sheet-up_0.3s_var(--ease-out-soft)_backwards] sm:animate-scale-in'}`}
        onMouseDown={(e) => e.stopPropagation()}>
        {/* Grab handle, a familiar bottom-sheet cue on phones */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true"><span className="h-1.5 w-10 rounded-full bg-slate-300" /></div>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={requestClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 desk:h-8 desk:w-8"><X className="h-5 w-5" /></button>
        </div>
        {askDiscard && (
          <div role="alert" className="flex animate-slide-down flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
            <span className="flex-1 font-medium">Discard your changes?</span>
            <Button size="sm" variant="secondary" onClick={() => setAskDiscard(false)}>Keep editing</Button>
            <Button size="sm" variant="danger" onClick={() => closeRef.current()}>Discard</Button>
          </div>
        )}
        <div className="dialog-body max-h-[65vh] overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[70vh] sm:px-5">{children}</div>
        {/* On phones footer buttons share the full width, so they're easy to hit with a thumb. */}
        {footer && <div className="dialog-footer flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-5 [&>*]:flex-1 sm:[&>*]:flex-none">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// Icon-only button. `label` is required: it's read by screen readers and shown as a tooltip.
export function IconButton({ icon: Icon, label, tone = 'default', className = '', ...props }) {
  const tones = { default: 'text-slate-500 hover:text-slate-800', danger: 'text-rose-600 hover:text-rose-700', success: 'text-emerald-600 hover:text-emerald-700', warn: 'text-amber-600 hover:text-amber-700' };
  return (
    <button type="button" aria-label={label} title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition duration-150 desk:h-8 desk:w-8 hover:bg-slate-100 active:scale-90 disabled:opacity-50 ${tones[tone]} ${className}`} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Field({ label, children, className = '', hint }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{typeof label === 'string' ? <Term>{label}</Term> : label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// Password field with a show/hide toggle. Accepts the same props as <input>.
export function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`input pr-10 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Spinner({ className = '' }) {
  return (
    // Fades in after a short delay so quick loads don't flash a spinner.
    <div role="status" aria-live="polite" className={`flex justify-center py-12 ${className}`}>
      <Loader2 aria-hidden="true" className="h-6 w-6 text-brand-600 [animation:spin_1s_linear_infinite,fade-in_0.3s_0.2s_backwards]" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function Empty({ title = 'Nothing here yet', children, icon: Icon = Inbox }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center px-4 py-12 text-center">
      <Icon className="mb-3 h-10 w-10 animate-pop-in text-slate-300" />
      <p className="font-medium text-slate-600">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600',
    blue: 'bg-sky-50 text-sky-600', purple: 'bg-violet-50 text-violet-600', green: 'bg-emerald-50 text-emerald-600',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    // Rendered as a real button when clickable so it works with the keyboard and screen readers.
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`card flex w-full items-start gap-3 p-4 text-left sm:gap-4 sm:p-5 ${onClick ? 'lift cursor-pointer hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-600' : ''}`}>
      {/* Phones show two cards per row, so the icon tucks away and the number gets the room. */}
      {Icon && <div className={`hidden rounded-lg p-2.5 min-[420px]:block ${tones[tone]}`}><Icon className="h-5 w-5" /></div>}
      <div className="min-w-0">
        <p className="text-sm leading-snug text-slate-500"><Term>{label}</Term></p>
        <p className="mt-0.5 text-xl font-bold text-slate-900 sm:text-2xl"><Animated value={value} /></p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </Tag>
  );
}

export function Avatar({ user, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl', xl: 'h-24 w-24 text-3xl' };
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
  // Photos are stored as server paths (/uploads/...); in production the API is on another domain.
  const src = user?.avatar?.startsWith('/uploads') ? `${import.meta.env.VITE_API_ORIGIN || ''}${user.avatar}` : user?.avatar;
  if (src) return <img src={src} alt="" className={`${sizes[size]} shrink-0 rounded-full object-cover ring-2 ring-white`} />;
  return (
    <div className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ring-2 ring-white`}>
      {initials || '?'}
    </div>
  );
}

// Tabs with an underline that slides to the selected tab.
export function Tabs({ tabs, value, onChange }) {
  const list = useRef(null);
  const [bar, setBar] = useState(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  // On phones the tabs scroll sideways: keep the chosen one in view and fade whichever edge hides more.
  const measure = () => {
    const el = list.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useLayoutEffect(() => {
    const box = list.current;
    const el = box?.querySelector('[aria-selected="true"]');
    if (el) {
      setBar({ left: el.offsetLeft, width: el.offsetWidth });
      if (el.offsetLeft < box.scrollLeft || el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth) {
        box.scrollTo({ left: el.offsetLeft - 24, behavior: 'smooth' });
      }
    }
    measure();
  }, [value, tabs.length]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const fade = edges.left && edges.right ? 'linear-gradient(to right, transparent, #000 2rem, #000 calc(100% - 2rem), transparent)'
    : edges.right ? 'linear-gradient(to right, #000 calc(100% - 2.5rem), transparent)'
      : edges.left ? 'linear-gradient(to left, #000 calc(100% - 2.5rem), transparent)' : undefined;
  return (
    <div ref={list} role="tablist" onScroll={measure} style={{ maskImage: fade, WebkitMaskImage: fade }}
      className="relative mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`min-h-11 whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors desk:min-h-0 ${
            value === t.value ? 'text-brand-700' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{t.count}</span>}
        </button>
      ))}
      {bar && <span aria-hidden="true" className="absolute bottom-0 h-0.5 rounded-full bg-brand-600 transition-all duration-300 ease-out" style={{ left: bar.left, width: bar.width }} />}
    </div>
  );
}

// Counts numbers up when they first appear or change; other values (e.g. "2/6", "—") render as-is.
export function Animated({ value, decimals = 0 }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const shown = useCountUp(numeric ? value : 0);
  if (!numeric) return <>{value ?? '—'}</>;
  return <>{shown.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}</>;
}

export function ProgressBar({ value, tone }) {
  const v = value ?? 0;
  const color = tone || (v >= 85 ? 'bg-emerald-500' : v >= 65 ? 'bg-amber-500' : 'bg-rose-500');
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full origin-left animate-grow-x rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(100, v)}%` }} />
    </div>
  );
}

// Animated success mark: the circle pops in and the tick draws itself.
export function SuccessCheck({ className = 'h-14 w-14' }) {
  return (
    <span className={`relative mx-auto flex items-center justify-center ${className}`} aria-hidden="true">
      <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-400 [animation-iteration-count:2]" />
      <svg viewBox="0 0 52 52" className="relative h-full w-full animate-pop-in">
        <circle cx="26" cy="26" r="25" className="fill-emerald-500" />
        <path d="M15 27l7 7 15-16" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="30" className="animate-draw" />
      </svg>
    </span>
  );
}

// Free-text tag list (e.g. required certificates). Enter or comma adds; × removes.
export function TagInput({ value = [], onChange, placeholder = 'Type and press Enter', suggestions = [], label }) {
  const [text, setText] = useState('');
  const listId = useId();
  const add = (raw) => {
    const t = raw.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText('');
  };
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="inline-flex animate-pop-in items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-100"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        <input value={text} list={suggestions.length ? listId : undefined} aria-label={label || placeholder} placeholder={value.length ? '' : placeholder}
          className="min-w-32 flex-1 bg-transparent px-2 py-1.5 text-base outline-none desk:text-sm"
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value.slice(0, -1)) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(text); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)} />
      </div>
      {suggestions.length > 0 && <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}
