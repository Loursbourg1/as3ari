import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { AppDataProvider } from './data/AppDataProvider';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { AppShell } from './components/AppShell';
import { PageContainer, Spinner } from './components/ui';
import FeedPage from './pages/FeedPage';
import ExplorePage from './pages/ExplorePage';

const MapPage = lazy(() => import('./pages/MapPage'));
const TrendsPage = lazy(() => import('./pages/TrendsPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const PlannerPage = lazy(() => import('./pages/PlannerPage'));
const ListsPage = lazy(() => import('./pages/ListsPage'));
const ContributePage = lazy(() => import('./pages/ContributePage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const ModerationPage = lazy(() => import('./pages/ModerationPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

function NotFound() {
  const { t } = useI18n();
  return (
    <PageContainer>
      <p className="text-sm text-muted">404</p>
      <Link to="/" className="font-semibold text-brand-700">
        {t('nav.feed')} →
      </Link>
    </PageContainer>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AppDataProvider>
          <BrowserRouter>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<FeedPage />} />
                  <Route path="map" element={<MapPage />} />
                  <Route path="trends" element={<TrendsPage />} />
                  <Route path="explore" element={<ExplorePage mode="explore" />} />
                  <Route path="product/:id" element={<ProductPage />} />
                  <Route path="shop/:id" element={<ShopPage />} />
                  <Route path="plan" element={<PlannerPage />} />
                  <Route path="lists" element={<ListsPage />} />
                  <Route path="contribute" element={<ContributePage />} />
                  <Route path="signin" element={<SignInPage />} />
                  <Route path="auth/callback" element={<AuthCallbackPage />} />
                  <Route path="me" element={<MyReportsPage />} />
                  <Route path="moderate" element={<ModerationPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AppDataProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
