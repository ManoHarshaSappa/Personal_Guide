"use client";

import { useEffect, useState } from "react";

const SPEECH_STOP_EVENT = "personal-guide:speech-stop";

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function SpeakButton({
  text,
  label = "Speak",
  className = "",
}: SpeakButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const synth = window.speechSynthesis;
    const handleStop = () => {
      setIsSpeaking(false);
    };

    window.addEventListener(SPEECH_STOP_EVENT, handleStop);

    return () => {
      window.removeEventListener(SPEECH_STOP_EVENT, handleStop);
      synth.cancel();
    };
  }, [isSupported]);

  function handleSpeak() {
    if (!isSupported || !text.trim()) {
      return;
    }

    const synth = window.speechSynthesis;

    if (isSpeaking) {
      window.dispatchEvent(new Event(SPEECH_STOP_EVENT));
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    window.dispatchEvent(new Event(SPEECH_STOP_EVENT));
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={!isSupported || !text.trim()}
      className={`inline-flex min-h-10 items-center justify-center self-start rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-sm ${className}`}
    >
      {isSpeaking ? "Stop" : label}
    </button>
  );
}
