import { useIdentity } from '../../features/identity/context/IdentityContext';
import { useEpisodeComposer } from '../../features/podcasts/context/EpisodeComposerContext';
import WalletPanel from '../../features/podcasts/components/WalletPanel';

interface AppSidebarProps {
  side: 'left' | 'right';
}

const AppSidebar = ({ side }: AppSidebarProps) => {
  const { activeName, address } = useIdentity();
  const { openCreate, openPlaylists } = useEpisodeComposer();

  if (side === 'left') {
    return (
      <div className="app-sidebar__content">
        <h2>Creator Panel</h2>
        <p>Active publisher</p>
        <strong>{activeName ?? 'No active name'}</strong>
        <button type="button" className="app-sidebar__primary-action" onClick={openCreate}>
          Publish new episode
        </button>
        <button type="button" className="app-sidebar__primary-action" onClick={openPlaylists}>
          Open playlists
        </button>
        <p>Address</p>
        <small>{address ?? '-'}</small>
        <WalletPanel activeName={activeName} compact />
      </div>
    );
  }

  return (
    <div className="app-sidebar__content">
      <h2>Network Notes</h2>
      <p>Publish episodes, curate playlists, and send QORT support to creators.</p>
      <p>All actions are written directly to Qortal resources and lists.</p>
    </div>
  );
};

export default AppSidebar;
