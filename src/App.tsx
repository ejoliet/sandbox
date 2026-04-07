import Header from '@/components/Layout/Header';
import Sidebar from '@/components/Layout/Sidebar';
import MapContainer from '@/components/Map/MapContainer';

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-cinema-bg overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 relative min-w-0">
          <MapContainer />
        </main>
      </div>
    </div>
  );
}
