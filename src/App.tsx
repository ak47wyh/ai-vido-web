import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './ui/layouts/MainLayout';
import { Dashboard } from './ui/pages/Dashboard';
import { CharacterManagement } from './ui/pages/CharacterManagement';
import { BackgroundManagement } from './ui/pages/BackgroundManagement';
import { StoryWorkbench } from './ui/pages/StoryWorkbench';
import { StorySpaceManagement } from './ui/pages/StorySpaceManagement';
import { Settings } from './ui/pages/Settings';
import { SpaceProvider } from './ui/contexts/SpaceContext';

function App() {
  return (
    <BrowserRouter>
      <SpaceProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="characters" element={<CharacterManagement />} />
            <Route path="backgrounds" element={<BackgroundManagement />} />
            <Route path="workbench" element={<StoryWorkbench />} />
            <Route path="spaces" element={<StorySpaceManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </SpaceProvider>
    </BrowserRouter>
  );
}

export default App;
