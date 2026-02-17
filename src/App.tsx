import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppWrapper } from './AppWrapper';
import HomePage from './features/home/pages/HomePage';

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
