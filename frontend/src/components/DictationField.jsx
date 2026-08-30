import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicNoneIcon from '@mui/icons-material/MicNone';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { motion, palette, tokens } from '../theme/theme.js';

/**
 * A multiline text field the broker can dictate into.
 *
 * This is not the voice recorder standing next to it. A recording is an attachment somebody has
 * to play; dictation produces the same text as typing, and notes get read, quoted in reviews and
 * searched across deals — none of which works on a .webm. The two answer different needs, so
 * both are offered.
 *
 * `onChange` is handed an event-shaped object, the contract every other field in the wizard uses
 * (see ValuationField), so `setField('notes')` can be passed straight in.
 *
 * Browser support is Chrome/Edge/Safari via the Web Speech API. Firefox has none, and there the
 * mic is not rendered at all rather than offered and dead. It also needs a secure context —
 * localhost and HTTPS work, a bare LAN IP over http silently will not.
 */

/** Joins dictated text onto what's already in the field, without doubling the space. */
const joinNote = (base, spoken) => {
  if (!base) return spoken;
  return /\s$/.test(base) ? base + spoken : `${base} ${spoken}`;
};

/**
 * What each Web Speech error code means to a broker who just tapped a mic and got nothing.
 *
 * react-speech-recognition acts on `not-allowed` and drops every other code on the floor, so
 * without this a refused session is indistinguishable from a dead button — which is exactly how
 * it looked the first time this ran on a deployed URL rather than localhost.
 *
 * `aborted` maps to null deliberately: it is what stopping normally and unmounting both raise,
 * and reporting it would cry wolf on every successful use.
 */
const ERROR_MESSAGES = {
  'not-allowed': 'Microphone access is blocked. Allow it from the padlock in the address bar, then reload.',
  'service-not-allowed': 'This browser refused its speech service. It usually means the page is inside a frame that disallows the microphone, or is not being served over HTTPS.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'Could not reach the speech service. Check the connection and try again.',
  'no-speech': 'Nothing was heard — try again, closer to the microphone.',
  'language-not-supported': 'This browser cannot dictate in this language.',
  aborted: null,
};

export function DictationField({ value, onChange, language = 'en-NZ', ...textFieldProps }) {
  const {
    finalTranscript,
    interimTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  // The recogniser is a global singleton — every mounted field sees the same transcript. This
  // says whether *this* field started the session, so an idle one can never splice someone
  // else's dictation into its own value.
  const [mine, setMine] = useState(false);
  const [micError, setMicError] = useState(null);
  const mineRef = useRef(false);
  // What the field held at the anchor point. Everything dictated is written as base + speech,
  // never appended to the live value: finalTranscript is cumulative for the session, so
  // appending would restate the whole session on every utterance.
  const baseRef = useRef('');
  const lastRef = useRef('');
  // Chrome ends sessions on its own — silence, a network blip — so teardown hangs off the
  // library's `listening` flag rather than the stop handler. This distinguishes "not started
  // yet" from "has ended", which are the same `false` on the tick after the click.
  const startedRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Rebuilt by setField on every render, so it cannot sit in the effect's deps without
  // re-firing the write each time.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const active = mine && listening;
  // An unrecognised code still gets said out loud — silence is what made this hard to diagnose
  // in the first place. `aborted` maps to null, which reads as "nothing worth reporting".
  const errorMessage = micError && !active
    ? (micError in ERROR_MESSAGES
      ? ERROR_MESSAGES[micError]
      : `Dictation stopped unexpectedly (${micError}).`)
    : null;

  // Only finalised speech is committed. The interim text churns every couple of hundred
  // milliseconds with half-recognised words — writing that to form state would re-render the
  // whole page on each partial and could persist a word the recogniser is about to revise. It
  // is shown live below the field instead, where it costs nothing.
  useEffect(() => {
    if (!mine) return;
    const spoken = finalTranscript.trim();
    // Recomposing from the anchor makes this idempotent: a re-render carrying the same
    // transcript writes nothing.
    if (!spoken || spoken === lastRef.current) return;
    lastRef.current = spoken;
    onChangeRef.current?.({ target: { value: joinNote(baseRef.current, spoken) } });
  }, [finalTranscript, mine]);

  // Session over, however it ended: fold what was said into the anchor and release the
  // singleton, so a later transcript belonging to another field cannot land in this one.
  useEffect(() => {
    if (listening) { startedRef.current = true; return; }
    if (!startedRef.current || !mineRef.current) return;
    startedRef.current = false;
    mineRef.current = false;
    setMine(false);
    baseRef.current = valueRef.current ?? '';
    lastRef.current = '';
    resetTranscript();
  }, [listening, resetTranscript]);

  // Abort, not stop: stopListening waits for a final result and would deliver it into a field
  // that no longer exists. Because the recogniser is global, leaving a session running would
  // also keep the tab's microphone indicator lit after the broker has navigated away.
  useEffect(() => () => { if (mineRef.current) SpeechRecognition.abortListening(); }, []);

  // Chained onto the recogniser's own handler rather than assigning over it — the library
  // installs `onError` there to catch `not-allowed`, and replacing it would take that with us.
  // Everything else it ignores, which is why a refused session used to leave the mic sitting
  // there looking idle.
  useEffect(() => {
    const recognition = SpeechRecognition.getRecognition();
    if (!recognition) return undefined;
    const librarysHandler = recognition.onerror;
    recognition.onerror = (event) => {
      librarysHandler?.call(recognition, event);
      const code = event?.error ?? 'unknown';
      // Logged as well as shown: the message is written for a broker, the code is what a
      // developer needs when this only reproduces on a deployed URL.
      console.warn('[dictation] speech recognition error:', code, event);
      if (mineRef.current) setMicError(code);
    };
    return () => { recognition.onerror = librarysHandler; };
  }, []);

  const handleStart = () => {
    setMicError(null);
    resetTranscript();
    baseRef.current = valueRef.current ?? '';
    lastRef.current = '';
    mineRef.current = true;
    setMine(true);
    SpeechRecognition.startListening({
      // False on some mobile browsers, where the session simply ends at each pause rather
      // than throwing.
      continuous: browserSupportsContinuousListening,
      language,
    }).catch((e) => {
      // A rejection here is the session never opening at all, which onerror does not cover.
      console.warn('[dictation] could not start listening:', e);
      setMicError('start-failed');
      mineRef.current = false;
      setMine(false);
    });
  };

  const handleStop = () => SpeechRecognition.stopListening();

  const handleChange = (e) => {
    if (mineRef.current) {
      // The broker corrected something by hand mid-session. Re-anchor rather than argue:
      // whatever is in the box now becomes the base and the transcript starts over, so the
      // next thing they say lands after their edit instead of overwriting it.
      baseRef.current = e.target.value;
      lastRef.current = '';
      resetTranscript();
    }
    onChange(e);
  };

  const micButton = (
    <InputAdornment
      position="end"
      // A multiline OutlinedInput centres its adornments against the whole textarea, which
      // leaves the mic floating in the middle of an empty box. It belongs on the first line.
      sx={{ alignSelf: 'flex-start', height: 'auto', mt: 1.25, mr: 0.25 }}
    >
      <Tooltip
        title={
          !isMicrophoneAvailable
            ? 'Microphone access is blocked. Allow it from the padlock in your address bar.'
            : active ? 'Stop dictating' : 'Dictate this note'
        }
      >
        {/* A disabled button emits no pointer events, so the tooltip needs a wrapper that does. */}
        <span>
          <IconButton
            size="small"
            onClick={active ? handleStop : handleStart}
            disabled={!isMicrophoneAvailable}
            aria-label={active ? 'Stop dictating' : 'Dictate this note'}
            aria-pressed={active}
            sx={motion.respectful({
              border: `1px solid ${active ? tokens.rejected : palette.ink[200]}`,
              color: active ? tokens.rejected : tokens.muted,
              backgroundColor: active ? palette.ink[50] : 'transparent',
              transition: `color ${motion.swift} ${motion.ease}, border-color ${motion.swift} ${motion.ease}`,
              '&:hover': {
                color: active ? tokens.rejected : tokens.blue,
                backgroundColor: palette.ink[50],
              },
            })}
          >
            {/* Filled vs outline carries the state on its own, so a reader who has asked for
                no motion still sees the change. */}
            {active ? <MicIcon fontSize="small" /> : <MicNoneIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </InputAdornment>
  );

  return (
    <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0 }}>
      <TextField
        {...textFieldProps}
        value={value}
        onChange={handleChange}
        multiline
        fullWidth
        InputProps={{
          endAdornment: browserSupportsSpeechRecognition ? micButton : undefined,
          sx: { alignItems: 'flex-start', pr: 0.5 },
        }}
      />

      {/* Height is reserved either way, so starting to dictate doesn't shove the voice
          recorder below down the page. */}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: 20, minWidth: 0 }}>
        {active && (
          <Box
            sx={motion.respectful({
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: tokens.rejected,
              flexShrink: 0,
              '@keyframes dictationPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              animation: 'dictationPulse 1.2s ease-in-out infinite',
            })}
          />
        )}
        {!browserSupportsSpeechRecognition ? (
          <Typography variant="caption" sx={{ color: tokens.muted }}>
            Dictation isn't available in this browser — use Chrome or Edge, or record a voice
            note below.
          </Typography>
        ) : errorMessage ? (
          <Typography variant="caption" role="status" sx={{ color: tokens.rejected }}>
            {errorMessage}
          </Typography>
        ) : active && (
          <>
            {/* The state word is announced; the interim text is not — a live region updating
                every couple of hundred milliseconds is unusable with a screen reader. */}
            <Typography variant="caption" aria-live="polite" sx={{ color: tokens.ink, flexShrink: 0 }}>
              Listening…
            </Typography>
            {interimTranscript && (
              <Typography
                variant="caption"
                aria-hidden
                sx={{
                  color: tokens.muted, fontStyle: 'italic', minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {interimTranscript}
              </Typography>
            )}
          </>
        )}
      </Stack>
    </Stack>
  );
}
