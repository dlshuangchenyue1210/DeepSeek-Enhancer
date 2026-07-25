import React from 'react';
import { createRoot } from 'react-dom/client';

import '@/src/styles.css';
import { initializeDiagnosticLogging } from '@/src/core/diagnosticLogging';
import { FolderPanel } from '@/src/features/folders/FolderPanel';

initializeDiagnosticLogging();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FolderPanel mode="sidepanel" />
  </React.StrictMode>,
);
