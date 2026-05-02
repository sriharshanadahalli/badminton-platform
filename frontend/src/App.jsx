import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MatchProvider } from './context/MatchContext';
import LandingView from './pages/LandingView';
import CourtView from './pages/CourtView';
import SignageView from './pages/SignageView';
import MobileLiveScore from './pages/MobileLiveScore';
import SchedulerView from './pages/SchedulerView';

function App() {
  return (
    <MatchProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/court/:courtId" element={<CourtView />} />
          <Route path="/signage/:signageId" element={<SignageView />} />
          <Route path="/livescore" element={<MobileLiveScore />} />
          <Route path="/scheduler" element={<SchedulerView />} />
        </Routes>
      </BrowserRouter>
    </MatchProvider>
  );
}

export default App;
