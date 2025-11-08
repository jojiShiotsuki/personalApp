import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Export from './pages/Export';
import CommandBar from './components/CommandBar';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
      <CommandBar />
    </BrowserRouter>
  );
}

export default App;
