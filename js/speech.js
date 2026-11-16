function normalizeLang(voice) {
  return (voice.lang || '').replace('_', '-').toLowerCase();
}

function pickVoice(voices) {
  return (
    voices.find((v) => normalizeLang(v) === 'en-gb') ??
    voices.find((v) => normalizeLang(v) === 'en' || normalizeLang(v).startsWith('en-')) ??
    null
  );
}

/**
 * Speech synthesis for English terms: en-GB voice, then any en-* voice, otherwise unavailable.
 * Voices may load asynchronously; subscribers are notified via onChange.
 * @param {SpeechSynthesis} [synth]
 * @param {typeof SpeechSynthesisUtterance} [Utterance]
 */
export function createSpeaker(
  synth = globalThis.speechSynthesis,
  Utterance = globalThis.SpeechSynthesisUtterance,
) {
  let voice = null;
  const listeners = new Set();

  function refresh() {
    let voices = [];
    try {
      voices = synth.getVoices() ?? [];
    } catch {
      voices = [];
    }
    const next = pickVoice(voices);
    const changed = (next === null) !== (voice === null);
    voice = next;
    if (changed) listeners.forEach((fn) => fn(voice !== null));
  }

  if (synth && Utterance) {
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
  }

  return {
    get available() {
      return voice !== null;
    },
    onChange(fn) {
      listeners.add(fn);
    },
    speak(text) {
      if (!voice) return;
      synth.cancel();
      const utterance = new Utterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      synth.speak(utterance);
    },
  };
}
