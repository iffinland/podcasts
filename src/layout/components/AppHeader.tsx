import { useEffect, useMemo, useRef, useState } from 'react';
import { useIdentity } from '../../features/identity/context/IdentityContext';

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

  return (
    <div className="app-header__content">
      <div className="app-header__brand">
        <img src={logoSrc} alt="Q-Podcasts logo" className="app-header__logo" />
        <div className="app-header__title">
          <h1>Podcasts (BETA)</h1>
          <p>Podcast publishing and discovery on QDN</p>
        </div>
      </div>

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
  );
};

export default AppHeader;
