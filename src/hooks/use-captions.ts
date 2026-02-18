import { useState, useRef, useCallback, useEffect } from "react";

// Extend the window type for vendor-prefixed SpeechRecognition
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor;
    webkitSpeechRecognition: ISpeechRecognitionConstructor;
  }
}

export interface UseCaptionsReturn {
  isSupported: boolean;
  isActive: boolean;
  isListening: boolean;
  partialText: string;
  captionHistory: string[];
  toggle: () => void;
  setLang: (lang: string) => void;
  lang: string;
  error: string | null;
}

const MAX_HISTORY = 20; // keep last 20 committed lines

export function useCaptions(): UseCaptionsReturn {
  const SpeechRecognitionImpl =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionImpl;

  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [captionHistory, setCaptionHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState<string>(
    () => localStorage.getItem("captionsLang") ?? "en-US"
  );

  const setLang = useCallback((newLang: string) => {
    localStorage.setItem("captionsLang", newLang);
    setLangState(newLang);
    // If currently active, restart recognition with new language
    if (shouldRunRef.current && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldRunRef = useRef(false);

  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionImpl) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = localStorage.getItem("captionsLang") ?? "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        // Always use the browser's top-ranked alternative — it is consistently
        // more accurate than confidence-based selection across alternatives.
        const transcript = result[0].transcript.trim();

        if (result.isFinal) {
          if (transcript) {
            setCaptionHistory((prev) => {
              const next = [...prev, transcript];
              return next.slice(-MAX_HISTORY);
            });
          }
        } else {
          partial = transcript;
        }
      }
      setPartialText(partial);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return; // benign, will auto-restart
      if (event.error === "aborted") return;   // we stopped it ourselves
      setError(`Microphone error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setPartialText("");
      // Auto-restart if we're still supposed to be running
      if (shouldRunRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore start errors on rapid restart
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      setError("Could not start microphone. Check permissions.");
    }
  }, [SpeechRecognitionImpl]);

  const stopRecognition = useCallback(() => {
    shouldRunRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setPartialText("");
  }, []);

  const toggle = useCallback(() => {
    setIsActive((prev) => {
      const next = !prev;
      if (next) {
        shouldRunRef.current = true;
        startRecognition();
      } else {
        stopRecognition();
        setCaptionHistory([]);
      }
      return next;
    });
  }, [startRecognition, stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    isSupported,
    isActive,
    isListening,
    partialText,
    captionHistory,
    toggle,
    setLang,
    lang,
    error,
  };
}

