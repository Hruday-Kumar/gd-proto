// Minimal RIFF/WAVE PCM reader — enough to load the TTS clips the bots "speak".
// Returns mono 16-bit samples plus the file's native sample rate (read from the
// header, so we don't care what exact rate the TTS engine produced).
import { readFileSync } from 'node:fs';

export function readWavMono16(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }

  let offset = 12;
  let fmt = null;
  let dataOffset = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataLen = size;
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || dataOffset < 0) throw new Error(`${path}: missing fmt/ or data chunk`);
  if (fmt.bitsPerSample !== 16) {
    throw new Error(`${path}: expected 16-bit PCM, got ${fmt.bitsPerSample}-bit`);
  }

  const end = Math.min(dataOffset + dataLen, buf.length);
  const interleaved = new Int16Array((end - dataOffset) >> 1);
  for (let i = 0; i < interleaved.length; i++) {
    interleaved[i] = buf.readInt16LE(dataOffset + i * 2);
  }

  // Downmix to mono if the file is stereo.
  let samples = interleaved;
  if (fmt.channels === 2) {
    samples = new Int16Array(interleaved.length >> 1);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (interleaved[2 * i] + interleaved[2 * i + 1]) >> 1;
    }
  }
  return { samples, sampleRate: fmt.sampleRate };
}
