import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

export function RadioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([70]);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <Card className="fixed bottom-4 right-4 p-4 bg-card/95 backdrop-blur-sm border-primary/20 shadow-lg w-80 z-50">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="outline"
          onClick={togglePlay}
          data-testid="button-radio-toggle"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>

        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">360 Radio</div>
          <div className="text-xs text-muted-foreground">
            {isPlaying ? 'Now Playing' : 'Click to Listen'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            className="w-8 h-8"
            data-testid="button-radio-mute"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={isMuted ? [0] : volume}
            onValueChange={setVolume}
            max={100}
            step={1}
            className="w-20"
            data-testid="slider-radio-volume"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Radio stream integration: Configure URL in backend
      </p>
    </Card>
  );
}
