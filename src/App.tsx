import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppWrapper } from './AppWrapper';

const HomePage = lazy(() => import('./features/home/pages/HomePage'));
const BrowseEpisodesPage = lazy(
  () => import('./features/podcasts/pages/BrowseEpisodesPage')
);
const MyPublishedEpisodesPage = lazy(
  () => import('./features/podcasts/pages/MyPublishedEpisodesPage')
);

interface CustomWindow extends Window {
  _qdnBase: string;
}

const customWindow = window as unknown as CustomWindow;
const baseUrl = customWindow?._qdnBase || '';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppWrapper />,
      errorElement: (
        <section role="alert">
          <p>This page could not be loaded.</p>
          <button onClick={() => window.location.reload()}>Reload app</button>
        </section>
      ),
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={<p role="status">Loading page...</p>}>
              <HomePage />
            </Suspense>
          ),
        },
        {
          path: 'episodes',
          element: (
            <Suspense fallback={<p role="status">Loading page...</p>}>
              <BrowseEpisodesPage />
            </Suspense>
          ),
        },
        {
          path: 'my-episodes',
          element: (
            <Suspense fallback={<p role="status">Loading page...</p>}>
              <MyPublishedEpisodesPage />
            </Suspense>
          ),
        },
        {
          path: 'e/:episodeKey',
          element: (
            <Suspense fallback={<p role="status">Loading page...</p>}>
              <HomePage />
            </Suspense>
          ),
        },
      ],
    },
  ],
  {
    basename: baseUrl,
  }
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
