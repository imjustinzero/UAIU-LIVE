import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";

export function RadioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <Card 
      className="fixed top-4 right-4 p-3 bg-card/95 backdrop-blur-sm border-primary/20 shadow-lg w-64 z-50"
      data-testid="radio-player-container"
    >
      <div className="flex items-center gap-3">
        <Button
          onClick={togglePlay}
          size="icon"
          variant={isPlaying ? "default" : "outline"}
          data-testid="button-radio-toggle"
        >
          {isPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
        <div className="flex-1">
          <div className="text-sm font-medium">360 Radio</div>
          <div className="text-xs text-muted-foreground">
            {isPlaying ? "Now Playing" : "Click to play"}
          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src="https://ssl.sonicpanel.com/8172/stream"
        preload="none"
        data-testid="radio-audio-player"
      />
    </Card>
  );
}
