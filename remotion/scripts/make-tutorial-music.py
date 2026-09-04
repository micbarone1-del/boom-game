import math
import wave

import numpy as np

RATE = 44_100
DURATION = 35.8
BPM = 150
BEAT = 60 / BPM
TOTAL = int(RATE * DURATION)
rng = np.random.default_rng(20260904)
mix = np.zeros(TOTAL, dtype=np.float64)


def add_tone(start, length, freq, volume, wave_type="square", decay=4.0):
    left = int(start * RATE)
    right = min(TOTAL, left + int(length * RATE))
    if left >= TOTAL or right <= left:
        return
    t = np.arange(right - left) / RATE
    phase = 2 * np.pi * freq * t
    if wave_type == "square":
        signal = np.sign(np.sin(phase)) * 0.72 + np.sin(phase * 2) * 0.18
    elif wave_type == "saw":
        signal = 2 * ((freq * t) % 1) - 1
    else:
        signal = np.sin(phase)
    envelope = np.minimum(1, t / 0.008) * np.exp(-decay * t / max(length, 0.01))
    mix[left:right] += signal * envelope * volume


def add_kick(start, volume=0.75):
    left = int(start * RATE)
    n = min(int(0.22 * RATE), TOTAL - left)
    if n <= 0:
        return
    t = np.arange(n) / RATE
    phase = 2 * np.pi * (88 * t - 48 * t * t)
    mix[left:left+n] += np.sin(phase) * np.exp(-22 * t) * volume


def add_snare(start, volume=0.28):
    left = int(start * RATE)
    n = min(int(0.14 * RATE), TOTAL - left)
    if n <= 0:
        return
    t = np.arange(n) / RATE
    noise = rng.standard_normal(n)
    mix[left:left+n] += noise * np.exp(-28 * t) * volume


# A short, repeatable five-note “BOOM” ringtone hook in A minor.
hook = [659.25, 783.99, 880.00, 783.99, 1046.50, 880.00, 783.99, 659.25]
bass = [110.00, 110.00, 130.81, 146.83, 110.00, 164.81, 146.83, 130.81]
steps = int(DURATION / (BEAT / 2)) + 1

for step in range(steps):
    at = step * BEAT / 2
    beat_index = step // 2
    if step % 2 == 0:
        add_kick(at, 0.72 if beat_index % 4 == 0 else 0.58)
    else:
        add_tone(at, 0.05, 6200, 0.055, "square", 12)
    if beat_index % 4 in (1, 3) and step % 2 == 0:
        add_snare(at, 0.25)
    add_tone(at, BEAT * 0.42, bass[beat_index % len(bass)], 0.18, "saw", 3.2)

    # The hook returns every two bars, becoming an easy-to-hum ringtone.
    note = hook[step % len(hook)]
    add_tone(at, BEAT * 0.38, note, 0.13, "square", 2.8)
    add_tone(at + 0.015, BEAT * 0.32, note * 2, 0.035, "square", 3.8)

# Extra “BOOM-boom!” turnaround at each four-bar boundary.
for bar in range(0, int(DURATION / (BEAT * 4)) + 1, 2):
    at = bar * BEAT * 4
    add_tone(at, BEAT * 0.7, 440, 0.15, "square", 2.0)
    add_tone(at + BEAT * 0.75, BEAT * 0.7, 659.25, 0.15, "square", 2.0)

# Gentle intro rise and clean ending.
fade_in = np.minimum(1, np.arange(TOTAL) / (RATE * 0.35))
fade_out = np.minimum(1, (TOTAL - np.arange(TOTAL)) / (RATE * 0.65))
mix *= fade_in * fade_out
mix = np.tanh(mix * 1.25)
peak = max(0.001, np.max(np.abs(mix)))
pcm = np.int16(np.clip(mix / peak * 0.88, -1, 1) * 32767)

with wave.open("/tmp/tutorial-v3/music.wav", "wb") as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(RATE)
    out.writeframes(pcm.tobytes())