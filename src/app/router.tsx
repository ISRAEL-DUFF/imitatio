import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';
import { AnalyzePage } from '@/features/analyze/AnalyzePage';
import { GeneratePage } from '@/features/generate/GeneratePage';
import { NotebookPage } from '@/features/notebook/NotebookPage';
import { EntryPage } from '@/features/pattern/EntryPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

// Routes from docs/SPEC.md §9.1.
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <NotebookPage /> },
      { path: '/analyze', element: <AnalyzePage /> },
      { path: '/entry/:id', element: <EntryPage /> },
      { path: '/entry/:id/generate', element: <GeneratePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
