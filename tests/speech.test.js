import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSpeechText, speechErrorMessage } from '../client/src/speech.js';

test('voice text appends to typed text and respects the explanation limit', () => {
  assert.equal(appendSpeechText('I remember', 'the scheduler chooses a process.'), 'I remember the scheduler chooses a process.');
  assert.equal(appendSpeechText('Already ended. ', ' New idea'), 'Already ended. New idea');
  assert.equal(appendSpeechText('x'.repeat(4_998), 'one two').length, 5_000);
  assert.equal(appendSpeechText('Keep this text', '   '), 'Keep this text');
});

test('voice errors have clear fallbacks for permission and unsupported-service problems', () => {
  assert.match(speechErrorMessage('not-allowed'), /Microphone access was blocked/);
  assert.match(speechErrorMessage('audio-capture'), /No microphone was found/);
  assert.match(speechErrorMessage('unknown-error'), /keep typing/);
});
