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
      children: [
        {
          index: true,
          element: (
            <Suspense fallback={null}>
              <HomePage />
            </Suspense>
          ),
        },
        {
          path: 'episodes',
          element: (
            <Suspense fallback={null}>
              <BrowseEpisodesPage />
            </Suspense>
          ),
        },
        {
          path: 'my-episodes',
          element: (
            <Suspense fallback={null}>
              <MyPublishedEpisodesPage />
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
