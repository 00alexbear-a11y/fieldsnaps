import { useState, useCallback, useRef, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as CapacitorSpeechRecognition } from "@capacitor-community/speech-recognition";

// Web Speech API types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition?: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognition;
    };
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Check permissions and support on mount
  useEffect(() => {
    checkSupportAndPermissions();
  }, []);

  const checkSupportAndPermissions = async () => {
    if (isNative) {
      try {
        // Check if native plugin is available
        const { available } = await CapacitorSpeechRecognition.available();
        setIsSupported(available);
        // Note: Permission status will be checked when user attempts to start
        setPermissionStatus('prompt');
      } catch (err) {
        console.error('[SpeechRecognition] Native check failed:', err);
        setIsSupported(false);
      }
    } else {
      // Desktop: Check Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
      
      if (SpeechRecognition) {
        initWebSpeechRecognition();
      }
    }
  };

  const initWebSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after first final result
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('[SpeechRecognition] Web Speech Started');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        }
      }

      if (finalTranscript) {
        setTranscript(prev => (prev + finalTranscript).trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SpeechRecognition] Web Speech Error:', event.error);
      
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please enable permissions in your browser settings.',
        'service-not-allowed': 'Speech recognition service is blocked. Please check your browser permissions.',
        'no-speech': 'No speech detected. Tap the microphone and try again.',
        'audio-capture': 'Microphone not found. Please connect a microphone and try again.',
        'network': 'Network error. Speech recognition requires an internet connection.',
        'aborted': 'Speech recognition was cancelled.',
      };
      
      setError(errorMessages[event.error] || `Error: ${event.error}. Please type manually or try again.`);
      setIsListening(false);
      
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermissionStatus('denied');
      }
    };

    recognition.onend = () => {
      console.log('[SpeechRecognition] Web Speech Ended');
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isNative) {
      // Web: permissions are requested on first start()
      return true;
    }

    try {
      const result = await CapacitorSpeechRecognition.requestPermissions();
      const granted = result?.speechRecognition === 'granted';
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (!granted) {
        setError('Microphone permission denied. Please enable it in Settings.');
      }
      
      return granted;
    } catch (err) {
      console.error('[SpeechRecognition] Permission request failed:', err);
      setError('Failed to request microphone permission');
      setPermissionStatus('denied');
      return false;
    }
  };

  const startListening = useCallback(async () => {
    setError(null);

    // Request permission if needed
    if (permissionStatus !== 'granted' && isNative) {
      const granted = await requestPermission();
      if (!granted) {
        setError('Microphone permission is required. Please enable it in your device settings.');
        return;
      }
    }

    // For web (especially Safari), explicitly request microphone access via getUserMedia
    // This triggers the browser's permission prompt before Web Speech API starts
    if (!isNative && permissionStatus !== 'granted') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately - we just needed it to trigger permission
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus('granted');
      } catch (err: any) {
        console.error('[SpeechRecognition] Microphone permission request failed:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Please allow microphone access in your browser settings.');
          setPermissionStatus('denied');
        } else {
          setError('Could not access microphone. Please check your browser settings.');
        }
        return;
      }
    }

    if (isNative) {
      // Native platform: Use Capacitor plugin
      let listenerHandle: any = null;
      
      try {
        // Reset transcript before starting new recording
        setTranscript('');
        
        // Register listener BEFORE starting and capture the handle
        listenerHandle = await CapacitorSpeechRecognition.addListener('partialResults', (data: any) => {
          if (data.matches && data.matches.length > 0) {
            setTranscript(data.matches[0]);
          }
        });

        setIsListening(true);

        // Start returns final matches when session ends
        const result = await CapacitorSpeechRecognition.start({
          language: 'en-US',
          maxResults: 1,
          prompt: 'Speak now...',
          partialResults: true,
          popup: false,
        });
        
        // Set final transcript from result
        if (result.matches && result.matches.length > 0) {
          setTranscript(result.matches[0]);
        }
        
        setIsListening(false);

      } catch (err: any) {
        console.error('[SpeechRecognition] Native start failed:', err);
        
        if (err.message?.includes('permission')) {
          setError('Microphone permission denied. Please enable it in Settings.');
          setPermissionStatus('denied');
        } else {
          setError('Failed to start speech recognition. Please type manually or try again.');
        }
        setIsListening(false);
      } finally {
        // Always remove listener when session ends (naturally or via error)
        if (listenerHandle) {
          await listenerHandle.remove();
        }
      }
    } else {
      // Desktop: Use Web Speech API
      if (!recognitionRef.current) {
        setError('Speech recognition not supported. Please type manually.');
        return;
      }

      try {
        setTranscript(''); // Reset on new start  
        setError(null);
        recognitionRef.current.start();
      } catch (err: any) {
        console.error('[SpeechRecognition] Web start failed:', err);
        
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please enable permissions and try again.');
          setPermissionStatus('denied');
        } else {
          setError('Failed to start speech recognition. Please type manually or refresh the page.');
        }
        setIsListening(false);
      }
    }
  }, [isNative, permissionStatus]);

  const stopListening = useCallback(async () => {
    try {
      if (isNative) {
        await CapacitorSpeechRecognition.stop();
        CapacitorSpeechRecognition.removeAllListeners();
      } else if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } catch (err) {
      console.error('[SpeechRecognition] Stop failed:', err);
      setIsListening(false);
    }
  }, [isNative]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNative) {
        CapacitorSpeechRecognition.removeAllListeners();
        CapacitorSpeechRecognition.stop().catch(() => {});
      } else if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isNative]);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    permissionStatus,
    startListening,
    stopListening,
    resetTranscript,
    requestPermission,
  };
}
