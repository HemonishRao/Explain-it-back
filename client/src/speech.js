export function appendSpeechText(existingText, spokenText) {
  const phrase = spokenText.trim();
  if (!phrase) return existingText;
  const separator = existingText && !/\s$/.test(existingText) ? ' ' : '';
  return `${existingText}${separator}${phrase}`.slice(0, 5_000);
}

export function speechErrorMessage(errorCode) {
  const messages = {
    'not-allowed': 'Microphone access was blocked. Allow microphone access in your browser settings and try again.',
    'service-not-allowed': 'The browser did not allow its speech recognition service to start.',
    'no-speech': 'No speech was detected. Try speaking a little closer to your microphone.',
    'audio-capture': 'No microphone was found. Connect a microphone and try again.',
    network: 'The speech recognition service could not connect. Check your connection and try again.',
    'language-not-supported': 'Speech recognition is not available for your browser’s current language.',
  };
  return messages[errorCode] || 'Voice input stopped unexpectedly. You can keep typing your explanation.';
}
