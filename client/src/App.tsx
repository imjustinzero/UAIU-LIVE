import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SkipLink from "@/components/SkipLink";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { SettingsProvider } from "@/lib/settings";
import { AuthProvider } from "@/lib/auth-context";
import Play from "@/pages/Play";
import Profile from "@/pages/Profile";
import Feed from "@/pages/Feed";
import LiveVideo from "@/pages/LiveVideo";
import Exchange from "@/pages/Exchange";
import Admin from "@/pages/Admin";
import Security from "@/pages/Security";
import Status from "@/pages/Status";
import Legal from "@/pages/Legal";
import ZStop from "@/pages/ZStop";
import SellerConnect from "@/pages/SellerConnect";
import RetireUpload from "@/pages/RetireUpload";
import VerifyTrade from "@/pages/VerifyTrade";
import DemoMode from "@/pages/DemoMode";
import Blog from "@/pages/Blog";
import Alerts from "@/pages/Alerts";
import Ledger from "@/pages/Ledger";
import IndexPage from "@/pages/IndexPage";
import Corsia from "@/pages/Corsia";
import ApiDocs from "@/pages/ApiDocs";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import NavigatorLanding from "@/pages/navigator/Landing";
import NavigatorIntake from "@/pages/navigator/Intake";
import NavigatorProject from "@/pages/navigator/ProjectDashboard";
import NavigatorDocuments from "@/pages/navigator/Documents";
import NavigatorGenerate from "@/pages/navigator/Generate";
import NavigatorVvb from "@/pages/navigator/Vvb";
import NavigatorTracker from "@/pages/navigator/Tracker";
import NavigatorProjects from "@/pages/navigator/Projects";
import Maritime from "@/pages/Maritime";
import MaritimeCarbonOffsetting from "@/pages/maritime/CarbonOffsetting";
import ChainExplorer from "@/pages/ChainExplorer";
import SupplierDashboard from "@/pages/SupplierDashboard";
import Trust from "@/pages/Trust";
import EsgDashboard from "@/pages/esg-dashboard";
import ProjectMonitorPage from "@/pages/project-monitor";
import VerifyPage from "@/pages/verify";
import StandardPage from "@/pages/standard";
import CommitteePage from "@/pages/committee";
import UvsRegistryPage from "@/pages/uvs-registry";
import UvsWidget from "@/pages/widget";
import DeviceCompatibilityPage from "@/pages/device-compatibility";
import DeviceSetupGuidePage from "@/pages/device-setup-guide";
import DeviceCertificationPage from "@/pages/device-certification";
import CbamPage from "@/pages/cbam";
import EpdBridgePage from "@/pages/epd-bridge";
import ProductPassportPage from "@/pages/product-passport";
import IsoVerifierPortalPage from "@/pages/iso-verifier-portal";
import SupplyChainMapPage from "@/pages/supply-chain-map";
import EnterpriseIndustrialPage from "@/pages/enterprise-industrial";
import GovContractsPage from "@/pages/gov-contracts";
import FederalBuyerPage from "@/pages/federal-buyer";
import GovSecurityPage from "@/pages/gov-security";
import VerifierMarketplacePage from "@/pages/verifier-marketplace";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Play} />
      <Route path="/profile" component={Profile} />
      <Route path="/feed" component={Feed} />
      <Route path="/live" component={LiveVideo} />
      <Route path="/verify/:hash" component={VerifyTrade} />
      <Route path="/blog" component={Blog} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/ledger" component={Ledger} />
      <Route path="/index" component={IndexPage} />
      <Route path="/corsia" component={Corsia} />
      <Route path="/api" component={ApiDocs} />
      <Route path="/x/reset-password" component={ResetPassword} />
      <Route path="/x/demo" component={DemoMode} />
      <Route path="/x" component={Exchange} />
      <Route path="/admin" component={Admin} />
      <Route path="/x/admin" component={Admin} />
      <Route path="/security" component={Security} />
      <Route path="/status" component={Status} />
      <Route path="/legal" component={Legal} />
      <Route path="/x/zstop" component={ZStop} />
      <Route path="/x/seller" component={SellerConnect} />
      <Route path="/x/chain" component={ChainExplorer} />
      <Route path="/x/supplier" component={SupplierDashboard} />
      <Route path="/x/trust" component={Trust} />
      <Route path="/x/esg" component={EsgDashboard} />
      <Route path="/x/projects" component={ProjectMonitorPage} />
      <Route path="/x/verify/:certificateNumber" component={VerifyPage} />
      <Route path="/x/standard" component={StandardPage} />
      <Route path="/x/committee" component={CommitteePage} />
      <Route path="/x/registry" component={UvsRegistryPage} />
      <Route path="/x/widget/:certificateNumber" component={UvsWidget} />
      <Route path="/x/developers/devices" component={DeviceCompatibilityPage} />
      <Route path="/x/developers/devices/:deviceSlug/setup" component={DeviceSetupGuidePage} />
      <Route path="/x/developers/certification" component={DeviceCertificationPage} />
      <Route path="/x/cbam" component={CbamPage} />
      <Route path="/x/epd" component={EpdBridgePage} />
      <Route path="/x/product/:certificateNumber" component={ProductPassportPage} />
      <Route path="/x/iso-verifier" component={IsoVerifierPortalPage} />
      <Route path="/x/supply-chain" component={SupplyChainMapPage} />
      <Route path="/x/enterprise/industrial" component={EnterpriseIndustrialPage} />
      <Route path="/x/gov/contract-vehicles" component={GovContractsPage} />
      <Route path="/x/gov/federal-buyer" component={FederalBuyerPage} />
      <Route path="/x/gov/security" component={GovSecurityPage} />
      <Route path="/x/verifiers/marketplace" component={VerifierMarketplacePage} />
      <Route path="/retire/:tradeId" component={RetireUpload} />
      <Route path="/navigator" component={NavigatorLanding} />
      <Route path="/navigator/intake" component={NavigatorIntake} />
      <Route path="/navigator/projects" component={NavigatorProjects} />
      <Route path="/navigator/project/:id" component={NavigatorProject} />
      <Route path="/navigator/project/:id/documents" component={NavigatorDocuments} />
      <Route path="/navigator/project/:id/generate" component={NavigatorGenerate} />
      <Route path="/navigator/project/:id/vvb" component={NavigatorVvb} />
      <Route path="/navigator/project/:id/tracker" component={NavigatorTracker} />
      <Route path="/maritime" component={Maritime} />
      <Route path="/maritime/carbon-offsetting" component={MaritimeCarbonOffsetting} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <TooltipProvider>
              <SkipLink />
              <Toaster />
              <main id="main" className="min-h-screen">
                <Router />
              </main>
            </TooltipProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
