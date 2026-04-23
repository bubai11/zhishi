import React, { Suspense, lazy, useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { motion, AnimatePresence } from 'motion/react';
import { getAlertUnreadCount, getUserProfile, login } from './api';
import type { UserProfile as UserProfileType } from './types';

type LibraryTaxonomyFilter = {
  familyId?: string;
  familyName?: string;
  familyScientificName?: string;
  genusScientificName?: string;
  divisionScientificName?: string;
  divisionName?: string;
};

const Home = lazy(() => import('./components/Home'));
const Library = lazy(() => import('./components/Library'));
const Classification = lazy(() => import('./components/Classification'));
const Analysis = lazy(() => import('./components/Analysis'));
const LearningCenter = lazy(() => import('./components/LearningCenter'));
const PlantDetail = lazy(() => import('./components/PlantDetail'));
const UserProfile = lazy(() => import('./components/UserProfile'));

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/+$/, '');
  const pageFromPath = pathname === '/plants' ? 'library' : '';
  return {
    page: params.get('page') || pageFromPath || 'home',
    plantId: params.get('plantId') || '1',
    librarySearch: params.get('search') || '',
    librarySort: params.get('sort') || 'latest',
    libraryPage: Math.max(1, Number(params.get('libraryPage')) || 1),
    libraryFamily: params.get('family') || '',
    libraryDivision: params.get('division') || ''
  };
}

export default function App() {
  const initialState = readStateFromUrl();
  const [currentPage, setCurrentPage] = useState(initialState.page);
  const [selectedPlantId, setSelectedPlantId] = useState<string>(initialState.plantId);
  const [librarySearch, setLibrarySearch] = useState(initialState.librarySearch);
  const [librarySort, setLibrarySort] = useState(initialState.librarySort);
  const [libraryPage, setLibraryPage] = useState(initialState.libraryPage);
  const [libraryTaxonomyFilter, setLibraryTaxonomyFilter] = useState<LibraryTaxonomyFilter>(
    initialState.libraryFamily
      ? { familyScientificName: initialState.libraryFamily }
      : initialState.libraryDivision
        ? { divisionScientificName: initialState.libraryDivision }
        : {}
  );
  const [classificationSearchQuery, setClassificationSearchQuery] = useState('');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<UserProfileType | null>(null);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  useEffect(() => {
    const params = new URLSearchParams();
    const usePlantsPath = currentPage === 'library' && Boolean(libraryTaxonomyFilter.familyScientificName || libraryTaxonomyFilter.divisionScientificName);
    if (currentPage && currentPage !== 'home' && !usePlantsPath) params.set('page', currentPage);
    if (selectedPlantId && currentPage === 'detail') params.set('plantId', selectedPlantId);
    if (librarySearch) params.set('search', librarySearch);
    if (librarySort && librarySort !== 'latest') params.set('sort', librarySort);
    if (libraryPage > 1) params.set('libraryPage', String(libraryPage));
    if (currentPage === 'library' && libraryTaxonomyFilter.familyScientificName) {
      params.set('family', libraryTaxonomyFilter.familyScientificName);
    }
    if (currentPage === 'library' && libraryTaxonomyFilter.divisionScientificName) {
      params.set('division', libraryTaxonomyFilter.divisionScientificName);
    }
    const query = params.toString();
    const nextPath = usePlantsPath ? '/plants' : window.location.pathname;
    const nextUrl = query ? `${nextPath}?${query}` : nextPath;
    window.history.replaceState({}, '', nextUrl);
  }, [currentPage, selectedPlantId, librarySearch, librarySort, libraryPage, libraryTaxonomyFilter.familyScientificName, libraryTaxonomyFilter.divisionScientificName]);

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

  const openLibraryWithTaxonomy = (filter: LibraryTaxonomyFilter) => {
    setLibraryTaxonomyFilter(filter);
    setLibraryPage(1);
    setCurrentPage('library');
  };

  const openLibraryWithFamily = (familyScientificName: string, familyName?: string) => {
    const normalizedFamily = String(familyScientificName || '').trim();
    if (!normalizedFamily) return;
    setLibraryTaxonomyFilter({
      familyScientificName: normalizedFamily,
      familyName: familyName || normalizedFamily
    });
    setLibraryPage(1);
    setCurrentPage('library');
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
            taxonomyFilter={libraryTaxonomyFilter}
            onTaxonomyFilterChange={setLibraryTaxonomyFilter}
          />
        );
      case 'classification':
        return (
          <Classification
            setCurrentPage={setCurrentPage}
            onSelectPlant={goToPlantDetail}
            onOpenLibraryWithTaxonomy={openLibraryWithTaxonomy}
            initialSearchQuery={classificationSearchQuery}
          />
        );
      case 'analysis':
        return <Analysis setCurrentPage={setCurrentPage} onSelectPlant={goToPlantDetail} onOpenLibraryWithFamily={openLibraryWithFamily} token={token} />;
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
        <Suspense
          fallback={
            <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6">
              <div className="rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm text-zinc-500 shadow-sm">
                页面加载中...
              </div>
            </div>
          }
        >
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
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
