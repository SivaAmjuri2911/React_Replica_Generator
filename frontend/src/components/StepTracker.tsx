import { Spinner } from './Spinner.js';

export type StepTrackerItemStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface StepTrackerItem {
  readonly key: string;
  readonly label: string;
  readonly status: StepTrackerItemStatus;
  /** Precomputed "currently: <file>" text — only meaningful while status is 'running'. */
  readonly currentDetail?: string;
}

interface StepTrackerProps {
  readonly title: string;
  readonly items: readonly StepTrackerItem[];
}

function StepIcon({ status }: { readonly status: StepTrackerItemStatus }): JSX.Element {
  if (status === 'running') {
    return <Spinner />;
  }
  if (status === 'succeeded') {
    return (
      <span className="step-icon step-icon-succeeded">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5L6.2 11.7L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="step-icon step-icon-failed">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return <span className="step-icon step-icon-pending" />;
}

/**
 * Renders an ordered vertical progress list — used for both the 10-step generation pipeline
 * and the 4-phase draft flow, since both share the same {name,label,status} shape (see
 * stepProgress.ts's toStepTrackerItems). Pending rows are hollow/grey, the running row shows
 * a spinner plus an optional "currently: <file>" line, and finished rows animate into a
 * green check or a red cross the moment their status flips (see .step-icon-succeeded's
 * step-pop animation in App.css) — no extra JS state needed for that transition.
 */
export function StepTracker({ title, items }: StepTrackerProps): JSX.Element {
  return (
    <div>
      <h3 className="step-tracker-title">{title}</h3>
      <ol className="step-tracker">
        {items.map((item) => (
          <li key={item.key} className={`step-item step-item-${item.status}`}>
            <StepIcon status={item.status} />
            <div>
              <div className="step-label">{item.label}</div>
              {item.status === 'running' && item.currentDetail && (
                <div className="step-detail" title={item.currentDetail}>
                  currently: {item.currentDetail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
