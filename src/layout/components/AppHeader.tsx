import { useEffect, useMemo, useRef, useState } from 'react';
import { useIdentity } from '../../features/identity/context/IdentityContext';
import { requestQortal } from '../../services/qortal/qortalClient';

const initialsFromName = (name: string | null): string => {
  if (!name) {
    return 'Q';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
};

const AppHeader = () => {
  const { activeName, availableNames, avatarUrl, isLoading, setActiveName } =
    useIdentity();
  const [isOpen, setIsOpen] = useState(false);
  const [isJoiningChat, setIsJoiningChat] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const logoSrc = `${import.meta.env.BASE_URL}podcast-logo-rounded-corner.png`;

  const initials = useMemo(() => initialsFromName(activeName), [activeName]);

  useEffect(() => {
    const closeIfOutside = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('click', closeIfOutside);
    return () => {
      window.removeEventListener('click', closeIfOutside);
    };
  }, []);

  const handleJoinChat = async () => {
    if (isJoiningChat) {
      return;
    }

    setIsJoiningChat(true);
    try {
      await requestQortal({
        action: 'JOIN_GROUP',
        groupId: 985,
      });
      window.alert('Chat group join request submitted.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not join the chat group.';
      window.alert(message);
    } finally {
      setIsJoiningChat(false);
    }
  };

  return (
    <div className="app-header__content">
      <div className="app-header__brand">
        <img src={logoSrc} alt="Q-Podcasts logo" className="app-header__logo" />
        <div className="app-header__title">
          <h1>Podcasts - listen-share-download</h1>
          <p>Publishing and discovering podcasts in the Qortal community</p>
        </div>
      </div>

      <div className="app-header__actions">
        <button
          type="button"
          className="app-header__join-chat"
          onClick={() => void handleJoinChat()}
          disabled={isJoiningChat}
        >
          <strong>JOIN THE OUR CHAT</strong>
          <span>Discussions / Feedback</span>
        </button>

        <div className="app-header__account" ref={containerRef}>
          <button
            type="button"
            className="app-header__identity"
            onClick={() => setIsOpen((value) => !value)}
            disabled={isLoading || availableNames.length === 0}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={activeName ? `${activeName} avatar` : 'User avatar'}
              />
            ) : (
              <div className="app-header__avatar-fallback">{initials}</div>
            )}

            <div className="app-header__identity-text">
              <strong>{activeName ?? 'Unknown user'}</strong>
              <span>
                {availableNames.length > 0
                  ? `${availableNames.length} names`
                  : 'No names'}
              </span>
            </div>

            <span className={`app-header__chevron ${isOpen ? 'open' : ''}`}>
              ▾
            </span>
          </button>

          {isOpen && availableNames.length > 0 ? (
            <div className="app-header__name-menu">
              {availableNames.map((name) => (
                <button
                  type="button"
                  key={name}
                  className={name === activeName ? 'active' : ''}
                  onClick={() => {
                    void setActiveName(name);
                    setIsOpen(false);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
