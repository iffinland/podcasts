import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRef } from 'react';
import type { UserAccount } from '../../../types/qortal';
import { requestQortal } from '../../../services/qortal/qortalClient';

interface AccountNameResponse {
  name?: string;
}

interface IdentityContextValue {
  address: string | null;
  publicKey: string | null;
  activeName: string | null;
  availableNames: string[];
  avatarUrl: string | null;
  isLoading: boolean;
  setActiveName: (name: string) => Promise<void>;
  refreshNames: () => Promise<void>;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

const normalizeNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }

      if (typeof entry === 'object' && entry !== null) {
        const candidate = (entry as AccountNameResponse).name;
        return typeof candidate === 'string' ? candidate : null;
      }

      return null;
    })
    .filter((name): name is string => Boolean(name && name.trim().length > 0));
};

export const IdentityProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<
    UserAccount & { isLoadingUser: boolean; avatarUrl?: string }
  >({ address: '', publicKey: '', name: '', isLoadingUser: true });
  const generation = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void requestQortal<UserAccount>({ action: 'GET_USER_ACCOUNT' })
      .then(async (account) => {
        let name = account.name ?? '';
        try {
          name = await requestQortal<string>({
            action: 'GET_PRIMARY_NAME',
            address: account.address,
          });
        } catch {
          /* Names lookup below provides a fallback. */
        }
        if (!cancelled) setAuth({ ...account, name, isLoadingUser: false });
      })
      .catch(() => {
        if (!cancelled)
          setAuth((previous) => ({ ...previous, isLoadingUser: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [availableNames, setAvailableNames] = useState<string[]>([]);
  const [activeName, setActiveNameState] = useState<string | null>(null);
  const [isLoadingNames, setIsLoadingNames] = useState(false);

  const syncNamesFromAccount = useCallback(async () => {
    if (!auth?.address) {
      setAvailableNames([]);
      setActiveNameState(null);
      return;
    }

    const requestId = ++generation.current;
    setIsLoadingNames(true);

    try {
      const response = await requestQortal<unknown>({
        action: 'GET_ACCOUNT_NAMES',
        address: auth.address,
      });

      if (requestId !== generation.current) return;
      const names = normalizeNames(response);
      const merged = Array.from(
        new Set([...(auth.name ? [auth.name] : []), ...names])
      );
      setAvailableNames(merged);

      setActiveNameState((previous) => {
        if (previous && merged.includes(previous)) {
          return previous;
        }

        if (auth.name && merged.includes(auth.name)) {
          return auth.name;
        }

        return merged[0] ?? auth.name ?? null;
      });
    } catch {
      if (requestId !== generation.current) return;
      const fallback = auth.name ? [auth.name] : [];
      setAvailableNames(fallback);
      setActiveNameState(auth.name ?? null);
    } finally {
      if (requestId === generation.current) setIsLoadingNames(false);
    }
  }, [auth.address, auth.name]);

  useEffect(() => {
    void syncNamesFromAccount();
  }, [syncNamesFromAccount]);

  useEffect(() => {
    if (!auth?.name) {
      return;
    }

    setActiveNameState((current) => current ?? auth.name ?? null);
    setAvailableNames((current) => {
      if (current.includes(auth.name as string)) {
        return current;
      }

      return [auth.name as string, ...current];
    });
  }, [auth?.name]);

  const setActiveName = useCallback(
    async (name: string) => {
      if (!name || name === activeName) {
        return;
      }

      setActiveNameState(name);
    },
    [activeName]
  );

  const avatarUrl = useMemo(() => {
    if (activeName) {
      return `/arbitrary/THUMBNAIL/${encodeURIComponent(activeName)}/qortal_avatar?async=true`;
    }

    return auth?.avatarUrl ?? null;
  }, [activeName, auth?.avatarUrl]);

  const value = useMemo<IdentityContextValue>(
    () => ({
      address: auth?.address ?? null,
      publicKey: auth?.publicKey ?? null,
      activeName,
      availableNames,
      avatarUrl,
      isLoading: auth?.isLoadingUser || isLoadingNames,
      setActiveName,
      refreshNames: syncNamesFromAccount,
    }),
    [
      auth?.address,
      auth?.publicKey,
      auth?.isLoadingUser,
      activeName,
      availableNames,
      avatarUrl,
      isLoadingNames,
      setActiveName,
      syncNamesFromAccount,
    ]
  );

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
};

export const useIdentity = () => {
  const context = useContext(IdentityContext);

  if (!context) {
    throw new Error('useIdentity must be used within IdentityProvider');
  }

  return context;
};
