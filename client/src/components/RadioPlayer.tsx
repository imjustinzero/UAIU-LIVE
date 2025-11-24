import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";

export function RadioPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (scriptLoadedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://embed.radio.co/player/1263649.js';
    script.async = true;
    script.setAttribute('data-testid', 'radio-embed-script');
    
    document.body.appendChild(script);
    scriptLoadedRef.current = true;

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <Card 
      className="fixed top-4 right-4 p-3 bg-card/95 backdrop-blur-sm border-primary/20 shadow-lg w-80 z-50"
      data-testid="radio-player-container"
    >
      <div ref={containerRef} id="radio-player-360" data-testid="radio-player-embed" />
    </Card>
  );
}
