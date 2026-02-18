
# Closed Captions for Received Audio

## What This Feature Does

Since QRPMobile is currently a simulated radio UI with no live RF hardware connected, "received audio" is interpreted as: **live microphone transcription** — the device mic picks up audio from the radio speaker (or room audio), and the app transcribes it in real time, displaying scrolling closed-caption text on the radio's LCD screen. This mirrors how a real SDR or digital radio companion app would work.

The captions will appear as a live scrolling ticker inside the radio screen, styled to match the existing phosphor-green LCD aesthetic. A CC toggle button will sit in the radio screen's bottom status bar.

---

## How It Works (Non-Technical)

1. You tap the **CC** button on the radio screen to enable closed captions.
2. The browser asks for microphone permission (one time).
3. As audio plays near the device (or you speak), the text appears on the radio's LCD display in real time — scrolling like a teletext or digital radio caption feed.
4. Tap CC again to turn it off.

---

## Technical Implementation

### Speech-to-Text Engine: ElevenLabs Scribe (Realtime)

- Uses the `@elevenlabs/react` package and the `useScribe` hook.
- Requires a **single-use token** generated server-side to keep the API key secure.
- The `ELEVENLABS_API_KEY` will be added as a Supabase secret via the ElevenLabs connector.
- Uses **VAD (Voice Activity Detection)** commit strategy — automatically finalises caption segments when silence is detected.

### Architecture

```text
User taps CC →
  Edge Function (elevenlabs-scribe-token) generates single-use token →
  useScribe hook opens WebSocket to ElevenLabs Scribe realtime →
  Microphone audio streams to ElevenLabs →
  Partial + committed transcripts returned →
  Displayed in RadioScreen LCD panel as scrolling captions
```

### Files to Create / Modify

1. **`supabase/functions/elevenlabs-scribe-token/index.ts`** *(new)*
   - Supabase Edge Function that calls the ElevenLabs single-use token API.
   - Uses `ELEVENLABS_API_KEY` secret from environment.
   - Returns `{ token }` for the client.

2. **`supabase/config.toml`** *(modify)*
   - Add `[functions.elevenlabs-scribe-token]` with `verify_jwt = false`.

3. **`src/hooks/use-captions.ts`** *(new)*
   - Custom React hook wrapping `useScribe`.
   - Handles: token fetch, connect/disconnect, transcript state (partial + committed history).
   - Exposes: `isConnected`, `isConnecting`, `partialText`, `captionHistory`, `toggle()`.

4. **`src/components/RadioScreen.tsx`** *(modify)*
   - Accept new props: `captionsEnabled`, `onToggleCaptions`, `partialCaption`, `captionHistory`.
   - Add **CC toggle button** to the bottom status bar (next to existing VOX/APRS tags).
   - Add a **caption panel** that appears between Channel B and the bottom bar when CC is active — styled as a green phosphor scrolling text area showing the last 2–3 lines of committed text plus the live partial in dimmer colour.

5. **`src/pages/Index.tsx`** *(modify)*
   - Instantiate `use-captions` hook.
   - Pass caption state and toggle handler down to `RadioScreen`.

### Caption Panel Design

The caption area inside the LCD will look like:

```
┌─────────────────────────────────┐
│ ▌ W2XYZ DE VK2ABC QRZ...        │  ← committed (bright green)
│   ...146.520 simplex monitoring  │  ← committed
│   seven three...                 │  ← partial (dim green, italic)
│                            [CC●] │  ← status
└─────────────────────────────────┘
```

- Committed captions: `hsl(140 70% 52%)` (matching the channel-A green tint)
- Partial caption: `hsl(140 70% 35%)` dimmed, slight italic
- Panel has a subtle scanline overlay to match the LCD aesthetic
- Max 3 lines visible; auto-scrolls to bottom
- Fades in with a CSS animation when CC is toggled on

### ElevenLabs Connector Setup

Before implementation, the ElevenLabs connector needs to be linked to this project. This will add `ELEVENLABS_API_KEY` to the project's secrets. This is a one-time step prompted to you during implementation.

### Package Required

```
npm install @elevenlabs/react
```

This adds the `useScribe` hook for realtime WebSocket transcription.

---

## Summary of Changes

| File | Action | Purpose |
|---|---|---|
| `supabase/functions/elevenlabs-scribe-token/index.ts` | Create | Server-side token generation |
| `supabase/config.toml` | Modify | Register new edge function |
| `src/hooks/use-captions.ts` | Create | Transcription state management |
| `src/components/RadioScreen.tsx` | Modify | CC button + caption panel in LCD |
| `src/pages/Index.tsx` | Modify | Wire up hook and pass props |
| `package.json` | Modify | Add `@elevenlabs/react` dependency |
