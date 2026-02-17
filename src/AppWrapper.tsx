import { GlobalProvider } from 'qapp-core';
import Layout from './styles/Layout';
import { publicSalt } from './qapp-config';
import { IdentityProvider } from './features/identity/context/IdentityContext';

export const AppWrapper = () => {
  return (
    <GlobalProvider
      config={{
        appName: 'Q-Podcasts',
        auth: {
          balanceSetting: {
            interval: 180000,
            onlyOnMount: false,
          },
          authenticateOnMount: true,
        },
        publicSalt: publicSalt,
      }}
    >
      <IdentityProvider>
        <Layout />
      </IdentityProvider>
    </GlobalProvider>
  );
};
