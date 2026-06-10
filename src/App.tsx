import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './ui/layouts/MainLayout';
import { Dashboard } from './ui/pages/Dashboard';
import { CharacterManagement } from './ui/pages/CharacterManagement';
import { BackgroundManagement } from './ui/pages/BackgroundManagement';
import { StoryWorkbench } from './ui/pages/StoryWorkbench';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="characters" element={<CharacterManagement />} />
          <Route path="backgrounds" element={<BackgroundManagement />} />
          <Route path="workbench" element={<StoryWorkbench />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
