import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PayoutModalProps {
  open: boolean;
  onClose: () => void;
  credits: number;
  userId: string;
  onPayoutSuccess: () => void;
}

export function PayoutModal({ open, onClose, credits, userId, onPayoutSuccess }: PayoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      toast({
        title: "Confirmation Required",
        description: "Please confirm that you understand all credits will be reset to zero.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const sessionId = localStorage.getItem('pong-session');
      const response = await fetch('/api/payout/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          paymentMethod,
          paymentInfo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Payout request failed');
      }

      toast({
        title: "Payout Requested!",
        description: `Your request for ${credits.toFixed(1)} credits has been submitted. You'll receive payment via ${paymentMethod} soon.`,
      });
      onPayoutSuccess();
      onClose();
      setPaymentMethod('');
      setPaymentInfo('');
      setConfirmed(false);
    } catch (error: any) {
      toast({
        title: "Payout Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const payoutAmount = ((credits / 10) * 0.9).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            Request Payout
          </DialogTitle>
          <DialogDescription>
            Cash out your credits for real money
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> All credits will be reset to zero upon payout request.
          </AlertDescription>
        </Alert>

        <div className="bg-muted rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current Credits:</span>
            <span className="font-mono font-bold text-lg text-primary">{credits.toFixed(1)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Payout Amount (10%):</span>
            <span className="font-mono font-bold text-xl text-green-600">${payoutAmount}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger id="payment-method" data-testid="select-payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CashApp">CashApp</SelectItem>
                <SelectItem value="Venmo">Venmo</SelectItem>
                <SelectItem value="PayPal">PayPal</SelectItem>
                <SelectItem value="Zelle">Zelle</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-info">Payment Handle / Email</Label>
            <Input
              id="payment-info"
              value={paymentInfo}
              onChange={(e) => setPaymentInfo(e.target.value)}
              placeholder="$yourtag or email@example.com"
              required
              data-testid="input-payment-info"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              data-testid="checkbox-confirm-reset"
            />
            <label
              htmlFor="confirm"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand all credits will be reset to zero
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              data-testid="button-cancel-payout"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !paymentMethod || !paymentInfo || !confirmed}
              data-testid="button-submit-payout"
            >
              {isLoading ? "Submitting..." : "Request Payout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
