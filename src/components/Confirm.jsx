import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button, Field, Modal, PasswordInput } from './ui';

// Styled replacement for window.confirm / window.prompt.
//   const ask = useConfirm();
//   if (!(await ask({ title, message, confirmLabel, tone: 'danger' }))) return;
//   const reason = await ask({ title, input: { label, required } });   // string, or false if cancelled
//   const pw = await ask({ title, password: true });                    // new password (typed twice), or false
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [error, setError] = useState('');
  const resolver = useRef(null);

  const ask = useCallback((o) => new Promise((resolve) => {
    resolver.current = resolve;
    setValue(''); setValue2(''); setError('');
    setOpts(o);
  }), []);

  const finish = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  const submit = (e) => {
    e.preventDefault();
    if (opts.password) {
      if (value.length < 6) return setError('Use at least 6 characters.');
      if (value !== value2) return setError("The two passwords don't match.");
      return finish(value);
    }
    if (opts.input) {
      if (opts.input.required && !value.trim()) return setError('This is required.');
      return finish(value.trim());
    }
    finish(true);
  };

  const tone = opts?.tone || 'primary';
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Modal open={!!opts} onClose={() => finish(false)} title={opts?.title} size="sm" guardChanges={false}
        footer={<>
          <Button variant="secondary" onClick={() => finish(false)}>{opts?.cancelLabel || 'Cancel'}</Button>
          <Button form="confirm-form" variant={tone === 'danger' ? 'danger' : 'primary'}>{opts?.confirmLabel || 'Confirm'}</Button>
        </>}>
        <form id="confirm-form" onSubmit={submit} className="space-y-4">
          {opts?.message && <p className="text-sm text-slate-600">{opts.message}</p>}
          {opts?.input && (
            <Field label={opts.input.label}>
              {opts.input.multiline !== false
                ? <textarea rows={3} className="input" placeholder={opts.input.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
                : <input className="input" placeholder={opts.input.placeholder} value={value} onChange={(e) => setValue(e.target.value)} />}
            </Field>
          )}
          {opts?.password && (
            <>
              <Field label="New password" hint="At least 6 characters"><PasswordInput autoComplete="new-password" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
              <Field label="Type it again"><PasswordInput autoComplete="new-password" value={value2} onChange={(e) => setValue2(e.target.value)} /></Field>
            </>
          )}
          {error && <p key={error} role="alert" className="animate-shake text-sm text-rose-600">{error}</p>}
        </form>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
