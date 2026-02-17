import { Outlet } from 'react-router-dom';
import { useIframe } from '../hooks/useIframeListener';
import AppHeader from '../layout/components/AppHeader';
import AppSidebar from '../layout/components/AppSidebar';
import { EpisodeComposerProvider } from '../features/podcasts/context/EpisodeComposerContext';
import '../layout/styles/layout.css';

const Layout = () => {
  useIframe();

  return (
    <EpisodeComposerProvider>
      <div className="app-shell">
        <header className="surface app-shell__header">
          <AppHeader />
        </header>

        <div className="app-shell__content">
          <aside className="surface app-shell__sidebar">
            <AppSidebar side="left" />
          </aside>

          <main className="app-shell__main">
            <Outlet />
          </main>

          <aside className="surface app-shell__sidebar">
            <AppSidebar side="right" />
          </aside>
        </div>
      </div>
    </EpisodeComposerProvider>
  );
};

export default Layout;
