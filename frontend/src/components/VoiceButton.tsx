import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscript }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Check webkitSpeechRecognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN'; // Set to English (India) to understand Indian currencies and phrasing

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Try Google Chrome.');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  return (
    <button
      onClick={toggleListening}
      style={{
        background: isListening ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        border: isListening ? '1px solid #f43f5e' : '1px solid var(--border-color)',
        padding: '10px',
        borderRadius: '50%',
        color: isListening ? '#f43f5e' : '#9ca3af',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isListening ? '0 0 15px rgba(244, 63, 94, 0.4)' : 'none',
        animation: isListening ? 'pulse 1.5s infinite' : 'none',
        transition: 'all 0.3s ease'
      }}
      title={isListening ? "Listening... click to stop" : "Click to speak"}
    >
      {isListening ? <MicOff size={18} /> : <Mic size={18} />}
      
      {/* Dynamic Keyframe Injection */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </button>
  );
};

export default VoiceButton;
