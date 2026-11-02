import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import HowItWorks from './pages/HowItWorks';
import Dashboard from './pages/Dashboard';
import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import GettingStarted from './pages/GettingStarted';
import ParentalRights from './pages/ParentalRights';
import ParentingTimeAndCommunication from './pages/ParentingTimeAndCommunication';
import InformationSharing from './pages/InformationSharing';
import TaxExemptions from './pages/TaxExemptions';
import Review from './pages/Review';
import TermsOfService from './pages/TermsOfService';
import ContactSupport from './pages/ContactSupport';
import PrivacyPolicy from './pages/PrivacyPolicy';
import InviteAccept from './pages/InviteAccept';
import Comparison from './pages/Comparison';
import WaitingScreen from './pages/WaitingScreen';
import ResolutionReview from './pages/ResolutionReview';
import AdminQuestionEditor from './pages/AdminQuestionEditor';
import FinalResolution from './pages/FinalResolution';
import AdminView from './pages/AdminView';
import FormDesigner from './pages/FormDesigner';
import { FormProvider } from './context/FormContext';
import { NavigationProvider } from './context/NavigationContext';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <FormProvider>
        <NavigationProvider>
          <Routes>
            {/* Landing page (no sidebar) */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/how-it-works" element={<HowItWorks />} />

        {/* Auth routes without sidebar */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Dashboard (no sidebar) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminView />} />
        <Route path="/admin/questions" element={<AdminQuestionEditor />} />

            {/* Form routes with sidebar */}
            <Route path="/getting-started" element={
              <MainLayout>
                <GettingStarted />
              </MainLayout>
            } />
            <Route path="/parental-rights" element={
              <MainLayout>
                <ParentalRights />
              </MainLayout>
            } />
            <Route path="/parenting-time-communication" element={
              <MainLayout>
                <ParentingTimeAndCommunication />
              </MainLayout>
            } />
            <Route path="/informationsharing" element={
              <MainLayout>
                <InformationSharing />
              </MainLayout>
            } />
            <Route path="/tax-exemptions" element={
              <MainLayout>
                <TaxExemptions />
              </MainLayout>
            } />
            <Route path="/aggregate-data" element={
              <AdminView />
            } />
            <Route path="/review" element={
              <MainLayout>
                <Review />
              </MainLayout>
            } />
            <Route path="/form-designer" element={
              <FormDesigner />
            } />
            
            {/* Static pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/contact-support" element={<ContactSupport />} />

            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route path="/comparison/:caseId" element={<Comparison />} />
            <Route path="/waiting/:caseId" element={<WaitingScreen />} />
            <Route path="/resolution-review/:caseId" element={<ResolutionReview />} />
            <Route path="/resolution/:caseId" element={<FinalResolution />} />

            {/* Catch all - redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NavigationProvider>
      </FormProvider>
    </BrowserRouter>
  );
}

export default App;