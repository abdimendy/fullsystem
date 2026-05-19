import { useEffect, useState } from 'react';
import { businessApi } from '../api/businessApi';
import { categoryApi } from '../api/categoryApi';
import { dashboardApi } from '../api/dashboardApi';
import { isUsingBundledPublicApi } from '../api/configureApi';
import HeroSection from '../components/home/HeroSection';
import TrustBar from '../components/home/TrustBar';
import SearchSection from '../components/home/SearchSection';
import CategoriesSection from '../components/home/CategoriesSection';
import FeaturedCompanies from '../components/home/FeaturedCompanies';
import MissionSection from '../components/home/MissionSection';
import VisionSection from '../components/home/VisionSection';
import StatsSection from '../components/home/StatsSection';
import PaymentPreview from '../components/home/PaymentPreview';
import TestimonialsSection from '../components/home/TestimonialsSection';
import ContactSection from '../components/home/ContactSection';
import { demoBusinessList, demoCategories, demoStats } from '../data/demoData';
import { ensureArray } from '../utils/apiHelpers';

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  useEffect(() => {
    categoryApi
      .getAll()
      .then((r) => setCategories(ensureArray(r.data)))
      .catch(() => {
        if (isUsingBundledPublicApi()) setCategories(demoCategories);
      });
    businessApi
      .getFeatured(6)
      .then((r) => setFeatured(ensureArray(r.data)))
      .catch(() => {
        if (isUsingBundledPublicApi()) setFeatured(demoBusinessList.slice(0, 6));
      })
      .finally(() => setLoadingFeatured(false));
    dashboardApi
      .getStats()
      .then((r) => setStats(r.data))
      .catch(() => {
        if (isUsingBundledPublicApi()) setStats(demoStats);
      });
  }, []);

  return (
    <>
      <HeroSection />
      <TrustBar />
      <SearchSection categories={categories} />
      <CategoriesSection categories={categories} />
      <FeaturedCompanies businesses={featured} loading={loadingFeatured} />
      <StatsSection stats={stats} />
      <MissionSection />
      <VisionSection />
      <PaymentPreview />
      <TestimonialsSection />
      <ContactSection />
    </>
  );
}
