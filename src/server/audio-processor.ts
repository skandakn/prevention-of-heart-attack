/**
 * G.711 Mu-law <-> Linear 16-bit PCM Audio Transcoder and Voice Activity Detector (VAD).
 */

// Precomputed Mu-law expansion table (8-bit mu-law -> 16-bit linear PCM)
const MULAW_TO_PCM = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mu = ~i;
  let sign = mu & 0x80;
  let exponent = (mu >> 4) & 0x07;
  let mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  MULAW_TO_PCM[i] = sign !== 0 ? -sample : sample;
}

export class AudioProcessor {
  /**
   * Decodes 8-bit Mu-law audio buffer to 16-bit linear PCM buffer.
   */
  public static mulawToPcm(mulawBuffer: Buffer): Buffer {
    const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);
    for (let i = 0; i < mulawBuffer.length; i++) {
      const sample = MULAW_TO_PCM[mulawBuffer[i]];
      pcmBuffer.writeInt16LE(sample, i * 2);
    }
    return pcmBuffer;
  }

  /**
   * Encodes 16-bit linear PCM audio buffer to 8-bit Mu-law buffer.
   */
  public static pcmToMulaw(pcmBuffer: Buffer): Buffer {
    const numSamples = Math.floor(pcmBuffer.length / 2);
    const mulawBuffer = Buffer.alloc(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2);
      mulawBuffer[i] = AudioProcessor.encodeSampleToMulaw(sample);
    }
    return mulawBuffer;
  }

  private static encodeSampleToMulaw(pcmSample: number): number {
    const BIAS = 0x84;
    const CLIP = 32635;

    let sign = (pcmSample >> 8) & 0x80;
    if (sign !== 0) pcmSample = -pcmSample;
    if (pcmSample > CLIP) pcmSample = CLIP;
    pcmSample = pcmSample + BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (pcmSample & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }

    let mantissa = (pcmSample >> (exponent + 3)) & 0x0f;
    let mulawByte = ~(sign | (exponent << 4) | mantissa);
    return mulawByte & 0xff;
  }

  /**
   * Calculates Root Mean Square (RMS) energy of 16-bit PCM buffer.
   */
  public static calculateRms(pcmBuffer: Buffer): number {
    const numSamples = Math.floor(pcmBuffer.length / 2);
    if (numSamples === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < numSamples; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2);
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / numSamples);
  }

  /**
   * Wraps raw linear PCM into a standard WAV container.
   */
  public static wrapPcmInWav(pcmData: Buffer, sampleRate = 8000, channels = 1): Buffer {
    const bitsPerSample = 16;
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // Linear PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
