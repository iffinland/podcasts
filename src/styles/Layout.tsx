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
                <aside className="surface app-shell__sidebar">
                  <AppSidebar side="left" />
                  <small className="app-shell__sidebar-footer">
                    since 2026
                  </small>
                </aside>

                <main className="app-shell__main">
                  <Outlet />
                </main>

                <aside className="surface app-shell__sidebar">
                  <AppSidebar side="right" />
                  <small className="app-shell__sidebar-footer">
                    app v.0.1.2
                  </small>
                </aside>
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
