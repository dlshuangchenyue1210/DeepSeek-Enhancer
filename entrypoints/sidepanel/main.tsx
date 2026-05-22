import React from 'react';
import { createRoot } from 'react-dom/client';

import '@/src/styles.css';
import { FolderPanel } from '@/src/features/folders/FolderPanel';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FolderPanel mode="sidepanel" />
  </React.StrictMode>,
);
