import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './ui/layouts/MainLayout';
import { Dashboard } from './ui/pages/Dashboard';
import { CharacterManagement } from './ui/pages/CharacterManagement';
import { BackgroundManagement } from './ui/pages/BackgroundManagement';
import { StoryWorkbench } from './ui/pages/StoryWorkbench';
import { StorySpaceManagement } from './ui/pages/StorySpaceManagement';
import { Settings } from './ui/pages/Settings';
import { ExportCenter } from './ui/pages/ExportCenter';
import { ImageLab } from './ui/pages/ImageLab';
import { VoiceLab } from './ui/pages/VoiceLab';
import { TextLab } from './ui/pages/TextLab';
import { VideoLab } from './ui/pages/VideoLab';
import { SpaceProvider } from './ui/contexts/SpaceContext';
import { ToastProvider } from './ui/contexts/ToastContext';
import { ConfirmProvider } from './ui/contexts/ConfirmContext';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { videoGenerationService } from './dependencies';

function App() {
  // Resume polling for any active video tasks after page reload
  React.useEffect(() => {
    videoGenerationService.resumeActivePolling().catch(console.error);
    return () => videoGenerationService.cancelAllPolling();
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SpaceProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="characters" element={<CharacterManagement />} />
                  <Route path="backgrounds" element={<BackgroundManagement />} />
                  <Route path="workbench" element={<StoryWorkbench />} />
                  <Route path="spaces" element={<StorySpaceManagement />} />
                  <Route path="export" element={<ExportCenter />} />
                  <Route path="labs/image" element={<ImageLab />} />
                  <Route path="labs/voice" element={<VoiceLab />} />
                  <Route path="labs/text" element={<TextLab />} />
                  <Route path="labs/video" element={<VideoLab />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </ConfirmProvider>
          </ToastProvider>
        </SpaceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
