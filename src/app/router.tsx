import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

// Routes from docs/SPEC.md §9.1. Screens load on demand, so the notebook opens
// without first downloading the analysis pipeline, Zod and the Markdown
// renderer.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        lazy: async () => ({ Component: (await import('@/features/notebook/NotebookPage')).NotebookPage }),
      },
      {
        path: '/analyze',
        lazy: async () => ({ Component: (await import('@/features/analyze/AnalyzePage')).AnalyzePage }),
      },
      {
        path: '/entry/:id',
        lazy: async () => ({ Component: (await import('@/features/pattern/EntryPage')).EntryPage }),
      },
      {
        path: '/entry/:id/generate',
        lazy: async () => ({ Component: (await import('@/features/generate/GeneratePage')).GeneratePage }),
      },
      {
        path: '/settings',
        lazy: async () => ({ Component: (await import('@/features/settings/SettingsPage')).SettingsPage }),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
