/**
 * @typedef {'design'|'projects'|'editor'} AppPage
 */

/**
 * @typedef {object} SiteHeaderProps
 * @property {AppPage} activePage
 * @property {number} projectCount
 * @property {(page: AppPage) => void} onNavigate
 */

/** @param {SiteHeaderProps} props */
export function SiteHeader({ activePage, projectCount, onNavigate }) {
    return (<header className="site-header-shell">
      <div className="site-header-inner">
        <button type="button" className="site-header-brand" onClick={() => onNavigate('design')} aria-label="Go to new design">
          <span className="site-header-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M8 1Q9.5 6.5 15 8Q9.5 9.5 8 15Q6.5 9.5 1 8Q6.5 6.5 8 1Z" fill="currentColor"/>
            </svg>
          </span>
          <span className="site-header-titles">
            <span className="site-header-title-row">
              <span className="site-header-title">Replica Generator</span>
              <span className="site-header-alt-name">ScenarioForge</span>
            </span>
            <span className="site-header-tagline">AI-powered coding scenario studio</span>
          </span>
        </button>

        <nav className="site-header-nav" aria-label="Main">
          <button type="button" className={`site-header-nav-link ${activePage === 'design' ? 'site-header-nav-link-active' : ''}`} onClick={() => onNavigate('design')}>
            New Design
          </button>
          <button type="button" className={`site-header-nav-link ${activePage === 'projects' || activePage === 'editor' ? 'site-header-nav-link-active' : ''}`} onClick={() => onNavigate('projects')}>
            All Projects
            {projectCount > 0 && <span className="site-header-nav-badge">{projectCount}</span>}
          </button>
        </nav>
      </div>
    </header>);
}
