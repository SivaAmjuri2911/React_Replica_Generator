/**
 * @typedef {object} SpinnerProps
 * @property {('sm'|'lg')} [size]
 * @property {string} [className]
 */

/**
 * Pure-CSS spinner (see .spinner in App.css) — no animation library needed.
 * @param {SpinnerProps} props
 */
export function Spinner({ size = 'sm', className }) {
    const classes = ['spinner', size === 'lg' ? 'spinner-lg' : '', className ?? ''].filter(Boolean).join(' ');
    return <span className={classes} aria-hidden="true"/>;
}
