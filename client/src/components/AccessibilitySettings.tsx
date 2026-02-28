import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings, FontSize } from "@/lib/settings";

const fontSizeOptions: { label: string; value: FontSize }[] = [
  { label: "Normal", value: "normal" },
  { label: "Large", value: "large" },
  { label: "X-Large", value: "x-large" },
];

export default function AccessibilitySettings() {
  const { fontSize, highContrast, setFontSize, setHighContrast } = useSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Accessibility settings"
          data-testid="button-accessibility-settings"
        >
          <Settings2 className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-4" align="end">
        <p className="text-sm font-semibold mb-3">Accessibility</p>

        <div className="mb-4">
          <Label className="text-xs text-muted-foreground mb-2 block">Text Size</Label>
          <div className="flex gap-1">
            {fontSizeOptions.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={fontSize === opt.value ? "default" : "outline"}
                onClick={() => setFontSize(opt.value)}
                data-testid={`button-fontsize-${opt.value}`}
                className="flex-1 text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="high-contrast-toggle" className="text-sm">
            High Contrast
          </Label>
          <Switch
            id="high-contrast-toggle"
            checked={highContrast}
            onCheckedChange={setHighContrast}
            data-testid="switch-high-contrast"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
