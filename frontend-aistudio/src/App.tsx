import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Library from './components/Library';
import Classification from './components/Classification';
import Analysis from './components/Analysis';
import LearningCenter from './components/LearningCenter';
import PlantDetail from './components/PlantDetail';
import UserProfile from './components/UserProfile';
import { motion, AnimatePresence } from 'motion/react';
import { getAlertUnreadCount, getUserProfile, login } from './api';
import type { UserProfile as UserProfileType } from './types';

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: params.get('page') || 'home',
    plantId: params.get('plantId') || '1',
    librarySearch: params.get('search') || '',
    librarySort: params.get('sort') || 'latest',
    libraryPage: Math.max(1, Number(params.get('libraryPage')) || 1)
  };
}

export default function App() {
  const initialState = readStateFromUrl();
  const [currentPage, setCurrentPage] = useState(initialState.page);
  const [selectedPlantId, setSelectedPlantId] = useState<string>(initialState.plantId);
  const [librarySearch, setLibrarySearch] = useState(initialState.librarySearch);
  const [librarySort, setLibrarySort] = useState(initialState.librarySort);
  const [libraryPage, setLibraryPage] = useState(initialState.libraryPage);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<UserProfileType | null>(null);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage && currentPage !== 'home') params.set('page', currentPage);
    if (selectedPlantId && currentPage === 'detail') params.set('plantId', selectedPlantId);
    if (librarySearch) params.set('search', librarySearch);
    if (librarySort && librarySort !== 'latest') params.set('sort', librarySort);
    if (libraryPage > 1) params.set('libraryPage', String(libraryPage));
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [currentPage, selectedPlantId, librarySearch, librarySort, libraryPage]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setAlertUnreadCount(0);
      return;
    }

    getUserProfile(token).then((profile) => {
      setUser(profile);
    }).catch(() => {
      setToken(null);
      setUser(null);
      setAlertUnreadCount(0);
      localStorage.removeItem('auth_token');
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const refreshAlertUnreadCount = () => {
      getAlertUnreadCount(token).then((result) => {
        if (!cancelled) {
          setAlertUnreadCount(result.total);
        }
      }).catch(() => {
        if (!cancelled) {
          setAlertUnreadCount(0);
        }
      });
    };

    refreshAlertUnreadCount();
    window.addEventListener('redlist-alerts-updated', refreshAlertUnreadCount);

    return () => {
      cancelled = true;
      window.removeEventListener('redlist-alerts-updated', refreshAlertUnreadCount);
    };
  }, [token]);

  const handleLogin = async (username: string, password: string) => {
    const result = await login(username, password);
    setToken(result.token);
    localStorage.setItem('auth_token', result.token);
    const profile = await getUserProfile(result.token);
    setUser(profile);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    setCurrentPage('home');
  };

  const goToPlantDetail = (plantId: string) => {
    setSelectedPlantId(plantId);
    setCurrentPage('detail');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Home
            setCurrentPage={setCurrentPage}
            onSelectPlant={goToPlantDetail}
            searchQuery={librarySearch}
            onSearchQueryChange={setLibrarySearch}
            onOpenLibrary={() => {
              setLibraryPage(1);
              setCurrentPage('library');
            }}
          />
        );
      case 'library':
        return (
          <Library
            setCurrentPage={setCurrentPage}
            onSelectPlant={goToPlantDetail}
            searchQuery={librarySearch}
            onSearchQueryChange={setLibrarySearch}
            sort={librarySort}
            onSortChange={setLibrarySort}
            page={libraryPage}
            onPageChange={setLibraryPage}
          />
        );
      case 'classification':
        return <Classification setCurrentPage={setCurrentPage} onSelectPlant={goToPlantDetail} />;
      case 'analysis':
        return <Analysis setCurrentPage={setCurrentPage} onSelectPlant={goToPlantDetail} token={token} />;
      case 'learning':
        return <LearningCenter setCurrentPage={setCurrentPage} token={token} onLogin={handleLogin} onSelectPlant={goToPlantDetail} />;
      case 'detail':
        return <PlantDetail plantId={selectedPlantId} setCurrentPage={setCurrentPage} token={token} />;
      case 'profile':
        return <UserProfile setCurrentPage={setCurrentPage} token={token} user={user} onLogout={handleLogout} />;
      default:
        return (
          <Home
            setCurrentPage={setCurrentPage}
            onSelectPlant={goToPlantDetail}
            searchQuery={librarySearch}
            onSearchQueryChange={setLibrarySearch}
            onOpenLibrary={() => {
              setLibraryPage(1);
              setCurrentPage('library');
            }}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter selection:bg-emerald-100 selection:text-emerald-900">
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} user={user} alertUnreadCount={alertUnreadCount} />
      <main className="flex-grow pt-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentPage}-${selectedPlantId}-${token ? 'auth' : 'guest'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
