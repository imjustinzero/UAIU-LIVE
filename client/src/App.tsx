import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SkipLink from "@/components/SkipLink";
import { SettingsProvider } from "@/lib/settings";
import Play from "@/pages/Play";
import Profile from "@/pages/Profile";
import Feed from "@/pages/Feed";
import LiveVideo from "@/pages/LiveVideo";
import Exchange from "@/pages/Exchange";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Play} />
      <Route path="/profile" component={Profile} />
      <Route path="/feed" component={Feed} />
      <Route path="/live" component={LiveVideo} />
      <Route path="/x" component={Exchange} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <TooltipProvider>
          <SkipLink />
          <Toaster />
          <main id="main" className="min-h-screen">
            <Router />
          </main>
        </TooltipProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
