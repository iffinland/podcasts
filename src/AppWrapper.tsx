import Layout from './styles/Layout';
import { IdentityProvider } from './features/identity/context/IdentityContext';

export const AppWrapper = () => (
  <IdentityProvider>
    <Layout />
  </IdentityProvider>
);
