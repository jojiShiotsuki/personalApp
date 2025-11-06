import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Placeholder pages (will create properly later)
function Dashboard() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Dashboard</h2></div>;
}

function Tasks() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Tasks</h2></div>;
}

function Contacts() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Contacts</h2></div>;
}

function Deals() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Deals</h2></div>;
}

function Export() {
  return <div className="p-8"><h2 className="text-2xl font-bold">Export</h2></div>;
}

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
    </BrowserRouter>
  );
}

export default App;
