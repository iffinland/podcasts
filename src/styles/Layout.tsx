import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useIframe } from '../hooks/useIframeListener';
import AppHeader from '../layout/components/AppHeader';
import AppSidebar from '../layout/components/AppSidebar';
import { EpisodeComposerProvider } from '../features/podcasts/context/EpisodeComposerContext';
import FloatingMiniPlayer from '../features/podcasts/components/FloatingMiniPlayer';
import { GlobalPlaybackProvider } from '../features/podcasts/context/GlobalPlaybackContext';
import { TagFilterProvider } from '../features/podcasts/context/TagFilterContext';
import { TopEpisodesProvider } from '../features/podcasts/context/TopEpisodesContext';
import '../layout/styles/layout.css';

const Layout = () => {
  useIframe();
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    window.matchMedia('(max-width: 1024px)').matches
  );
  const [openMobilePanel, setOpenMobilePanel] = useState<'left' | 'right'>(
    'left'
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches);
    };

    setIsMobileLayout(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const toggleMobilePanel = (panel: 'left' | 'right') => {
    setOpenMobilePanel(panel);
  };

  return (
    <GlobalPlaybackProvider>
      <TagFilterProvider>
        <TopEpisodesProvider>
          <EpisodeComposerProvider>
            <div className="app-shell">
              <header className="surface app-shell__header">
                <AppHeader />
              </header>

              <div className="app-shell__content">
                {isMobileLayout ? (
                  <section className="surface app-shell__mobile-sidebars">
                    <div className="app-shell__mobile-toggle-row">
                      <button
                        type="button"
                        className={`app-shell__mobile-toggle${openMobilePanel === 'left' ? ' is-active' : ''}`}
                        onClick={() => toggleMobilePanel('left')}
                      >
                        Menu & Filters
                      </button>
                      <button
                        type="button"
                        className={`app-shell__mobile-toggle${openMobilePanel === 'right' ? ' is-active' : ''}`}
                        onClick={() => toggleMobilePanel('right')}
                      >
                        Likes & Tips
                      </button>
                    </div>
                    <div className="app-shell__mobile-panel">
                      {openMobilePanel === 'left' ? (
                        <>
                          <AppSidebar side="left" />
                          <small className="app-shell__sidebar-footer">
                            since 2026
                          </small>
                        </>
                      ) : (
                        <>
                          <AppSidebar side="right" />
                          <small className="app-shell__sidebar-footer">
                            app v.1.0
                          </small>
                        </>
                      )}
                    </div>
                  </section>
                ) : (
                  <aside className="surface app-shell__sidebar">
                    <AppSidebar side="left" />
                    <small className="app-shell__sidebar-footer">
                      since 2026
                    </small>
                  </aside>
                )}

                <main className="app-shell__main">
                  <Outlet />
                </main>

                {!isMobileLayout ? (
                  <aside className="surface app-shell__sidebar">
                    <AppSidebar side="right" />
                    <small className="app-shell__sidebar-footer">
                      app v.1.0
                    </small>
                  </aside>
                ) : null}
              </div>
              <FloatingMiniPlayer />
            </div>
          </EpisodeComposerProvider>
        </TopEpisodesProvider>
      </TagFilterProvider>
    </GlobalPlaybackProvider>
  );
};

export default Layout;
