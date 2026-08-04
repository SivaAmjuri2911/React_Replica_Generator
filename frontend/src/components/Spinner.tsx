interface SpinnerProps {
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

/** Pure-CSS spinner (see .spinner in App.css) — no animation library needed. */
export function Spinner({ size = 'sm', className }: SpinnerProps): JSX.Element {
  const classes = ['spinner', size === 'lg' ? 'spinner-lg' : '', className ?? ''].filter(Boolean).join(' ');
  return <span className={classes} aria-hidden="true" />;
}
