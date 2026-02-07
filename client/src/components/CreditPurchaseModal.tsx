import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gem, Loader2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSessionId } from "@/lib/sessionHelper";

interface CreditPackage {
  productId: string;
  priceId: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  credits: number;
}

interface CreditPurchaseModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreditPurchaseModal({ open, onClose }: CreditPurchaseModalProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPackages();
    }
  }, [open]);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const sessionId = getSessionId();
      if (!sessionId) {
        toast({
          title: "Authentication Required",
          description: "Please log in to purchase credits.",
          variant: "destructive",
        });
        onClose();
        return;
      }

      const response = await fetch('/api/stripe/credit-packages', {
        headers: {
          'Authorization': `Bearer ${sessionId}`,
        },
      });

      if (response.status === 401) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        onClose();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch packages');
      }

      const data = await response.json();
      setPackages(data.packages);
    } catch (error) {
      console.error('Error fetching credit packages:', error);
      toast({
        title: "Error",
        description: "Failed to load credit packages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (priceId: string) => {
    setPurchasing(priceId);
    try {
      const sessionId = getSessionId();
      if (!sessionId) {
        toast({
          title: "Authentication Required",
          description: "Please log in to purchase credits.",
          variant: "destructive",
        });
        setPurchasing(null);
        onClose();
        return;
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ priceId }),
      });

      if (response.status === 401) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setPurchasing(null);
        onClose();
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setPurchasing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Gem className="w-6 h-6 text-primary" />
            Purchase Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No credit packages available at this time.
            </div>
          ) : (
            packages.map((pkg) => (
              <Card
                key={pkg.priceId}
                className="p-6 hover-elevate cursor-pointer transition-all"
                data-testid={`credit-package-${pkg.credits}`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-primary">{pkg.name}</h3>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-2xl font-bold">{pkg.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Gem className="w-4 h-4 text-primary" />
                        <span className="text-2xl font-bold text-primary">{pkg.credits}</span>
                        <span className="text-sm text-muted-foreground">credits</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handlePurchase(pkg.priceId)}
                    disabled={purchasing !== null}
                    size="lg"
                    data-testid={`button-purchase-${pkg.credits}`}
                  >
                    {purchasing === pkg.priceId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Purchase'
                    )}
                  </Button>
                </div>
              </Card>
            ))
          )}

          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>Credits will be added to your account immediately after payment.</p>
            <p>Secure payment powered by Stripe.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
