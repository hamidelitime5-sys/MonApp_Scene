/**
 * SoundFont 2 (SF2) RIFF Parser and Sample Extractor for Web Audio API
 */

export interface Sf2SampleHeader {
  name: string;
  start: number;
  end: number;
  startLoop: number;
  endLoop: number;
  sampleRate: number;
  originalPitch: number; // MIDI key number (e.g. 60 for C4)
  pitchCorrection: number; // cents (-50 to +50)
  sampleLink: number;
  sampleType: number;
  audioBuffer?: AudioBuffer;
}

export interface Sf2Preset {
  name: string;
  preset: number;
  bank: number;
  bagIndex: number;
}

export interface Sf2ParsedResult {
  name: string;
  comment?: string;
  soundEngine?: string;
  sampleHeaders: Sf2SampleHeader[];
  presets: Sf2Preset[];
  samplesCount: number;
  rawPcmDataLength: number;
  totalSizeMb: number;
}

/**
 * Parse an SF2 ArrayBuffer and extract audio buffers for Web Audio synthesis
 */
export function parseSf2File(arrayBuffer: ArrayBuffer, audioCtx: AudioContext): Sf2ParsedResult {
  const dataView = new DataView(arrayBuffer);
  const uint8 = new Uint8Array(arrayBuffer);

  const readFourCC = (offset: number): string => {
    let str = '';
    for (let i = 0; i < 4; i++) {
      str += String.fromCharCode(uint8[offset + i]);
    }
    return str;
  };

  const readString = (offset: number, length: number): string => {
    let str = '';
    for (let i = 0; i < length; i++) {
      const code = uint8[offset + i];
      if (code === 0) break; // null terminator
      str += String.fromCharCode(code);
    }
    return str.trim();
  };

  if (readFourCC(0) !== 'RIFF') {
    throw new Error('Format invalide: En-tête RIFF manquant dans le fichier SF2');
  }

  if (readFourCC(8) !== 'sfbk') {
    throw new Error('Format invalide: Ce fichier n\'est pas une banque SoundFont 2 (sfbk attendu)');
  }

  let sfName = 'SoundFont Personnalisée';
  let comment = '';
  let soundEngine = '';
  let smplOffset = -1;
  let smplLength = 0;
  const sampleHeaders: Sf2SampleHeader[] = [];
  const presets: Sf2Preset[] = [];

  let offset = 12;
  const totalLength = arrayBuffer.byteLength;

  while (offset < totalLength - 8) {
    const chunkType = readFourCC(offset);
    const chunkSize = dataView.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkType === 'LIST') {
      const listType = readFourCC(chunkDataOffset);
      let subOffset = chunkDataOffset + 4;
      const listEnd = chunkDataOffset + chunkSize;

      while (subOffset < listEnd - 8) {
        const subType = readFourCC(subOffset);
        const subSize = dataView.getUint32(subOffset + 4, true);
        const subDataOffset = subOffset + 8;

        // INFO Subchunks
        if (listType === 'INFO') {
          if (subType === 'INAM') {
            sfName = readString(subDataOffset, subSize);
          } else if (subType === 'ICMT') {
            comment = readString(subDataOffset, subSize);
          } else if (subType === 'ISFT') {
            soundEngine = readString(subDataOffset, subSize);
          }
        }

        // Sample Data Subchunks (sdta)
        if (listType === 'sdta') {
          if (subType === 'smpl') {
            smplOffset = subDataOffset;
            smplLength = subSize;
          }
        }

        // Preset and Sample Headers (pdta)
        if (listType === 'pdta') {
          if (subType === 'phdr') {
            // Preset headers are 38 bytes each
            const numPresets = Math.floor(subSize / 38);
            for (let p = 0; p < numPresets - 1; p++) {
              const pOffset = subDataOffset + p * 38;
              const pName = readString(pOffset, 20);
              const pNum = dataView.getUint16(pOffset + 20, true);
              const pBank = dataView.getUint16(pOffset + 22, true);
              const pBag = dataView.getUint16(pOffset + 24, true);
              if (pName && pName !== 'EOP') {
                presets.push({
                  name: pName,
                  preset: pNum,
                  bank: pBank,
                  bagIndex: pBag,
                });
              }
            }
          } else if (subType === 'shdr') {
            // Sample headers are 46 bytes each
            const numSamples = Math.floor(subSize / 46);
            for (let s = 0; s < numSamples - 1; s++) {
              const sOffset = subDataOffset + s * 46;
              const sName = readString(sOffset, 20);
              const start = dataView.getUint32(sOffset + 20, true);
              const end = dataView.getUint32(sOffset + 24, true);
              const startLoop = dataView.getUint32(sOffset + 28, true);
              const endLoop = dataView.getUint32(sOffset + 32, true);
              const sampleRate = dataView.getUint32(sOffset + 36, true);
              const originalPitch = dataView.getUint8(sOffset + 40);
              const pitchCorrection = dataView.getInt8(sOffset + 41);
              const sampleLink = dataView.getUint16(sOffset + 42, true);
              const sampleType = dataView.getUint16(sOffset + 44, true);

              if (sName && sName !== 'EOS' && end > start) {
                sampleHeaders.push({
                  name: sName,
                  start,
                  end,
                  startLoop,
                  endLoop,
                  sampleRate: sampleRate || 44100,
                  originalPitch: originalPitch || 60,
                  pitchCorrection: pitchCorrection || 0,
                  sampleLink,
                  sampleType,
                });
              }
            }
          }
        }

        subOffset += 8 + subSize;
        if (subSize % 2 !== 0) subOffset++; // 16-bit word alignment
      }
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // 16-bit word alignment
  }

  // Convert 16-bit PCM samples into Web Audio AudioBuffers for rapid polyphonic playback
  if (smplOffset > 0 && smplLength > 0 && sampleHeaders.length > 0) {
    const rawPcm = new Int16Array(arrayBuffer, smplOffset, Math.floor(smplLength / 2));

    for (const sh of sampleHeaders) {
      const sampleCount = sh.end - sh.start;
      if (sampleCount > 0 && sh.start + sampleCount <= rawPcm.length) {
        try {
          const buffer = audioCtx.createBuffer(1, sampleCount, sh.sampleRate);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < sampleCount; i++) {
            channelData[i] = rawPcm[sh.start + i] / 32768.0;
          }
          sh.audioBuffer = buffer;
        } catch (e) {
          console.warn(`Could not create AudioBuffer for sample ${sh.name}:`, e);
        }
      }
    }
  }

  return {
    name: sfName,
    comment,
    soundEngine,
    sampleHeaders,
    presets,
    samplesCount: sampleHeaders.length,
    rawPcmDataLength: smplLength,
    totalSizeMb: Math.round((totalLength / (1024 * 1024)) * 10) / 10,
  };
}
