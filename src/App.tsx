import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppWrapper } from './AppWrapper';
import HomePage from './features/home/pages/HomePage';
import BrowseEpisodesPage from './features/podcasts/pages/BrowseEpisodesPage';
import MyPublishedEpisodesPage from './features/podcasts/pages/MyPublishedEpisodesPage';

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
          element: <HomePage />,
        },
        {
          path: 'episodes',
          element: <BrowseEpisodesPage />,
        },
        {
          path: 'my-episodes',
          element: <MyPublishedEpisodesPage />,
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
