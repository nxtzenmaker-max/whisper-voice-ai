import WebSocket from 'ws';
import crypto from 'crypto';

const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;

const _SHA256_INITIAL = [
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19,
];
const _SHA256_STATE = [
  0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A,
  0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2,
];
const _SHA256_SCHEDULE = [
  0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA,
  0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6,
  0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33,
  0xD258B060, 0x72766564,
];
const _SHA256_ROUND_CONSTANTS = [
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
];
const _SHA256_ADJUSTMENT = 0xC9DC06A7;
const _SHA256_BLOCK_CONSTANTS = [
  ..._SHA256_ROUND_CONSTANTS.slice(0, 14),
  _SHA256_ADJUSTMENT,
  ..._SHA256_ROUND_CONSTANTS.slice(15),
];
const _SHA256_SIGMA0_ADJUSTMENT = 0x059C0B80;
const _SHA256_SIGMA1_ADJUSTMENT = 0x000B92C0;

const _CS64_COEFFICIENTS = [
  [0xE82E91B1, 0xB32700D0],
  [0x44DE24C6, 0x88DFF51D],
  [0x3BEB65BC, 0x29514038],
  [0xC89C5933, 0xB328CBDF],
  [0x8D1EC211, 0xD405B4D5],
  [0x314EF5D5, 0x26E55F3C],
  [0xE92491B1, 0x607801C6],
  [0xF0A5B9D5, 0x82B2C1FB],
  [0x06064CF3, 0xFA51A3DA],
  [0xDA79FA60, 0x207CC464],
  [0xBED20560, 0x3C3C74F3],
  [0x89F9C9F8, 0xD2D14B61],
  [0x35FA38C6, 0xBB04A2C1],
  [0xCB49E3C6, 0xC5626167],
];
const _CS64_FACTOR = 0x82893933;
const _CS64_ADJUSTMENT0 = 0xF2F90B1A;
const _CS64_ADJUSTMENT1 = 0x0B1A0000;
const _U32_MASK = BigInt('0xFFFFFFFF');

function rol16(val: number): number {
  const v = BigInt(val) & _U32_MASK;
  return Number(((v << BigInt(16)) | (v >> BigInt(16))) & _U32_MASK);
}

function wordsLe4Even(buf: Buffer): number[] {
  const len = buf.length;
  const padLen = (-len % 4 + 4) % 4;
  const padded = Buffer.concat([buf, Buffer.alloc(padLen)]);
  const words: number[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(padded.readUInt32LE(i));
  }
  if (words.length % 2 !== 0) words.push(0);
  return words;
}

function sigma0(value: number): number {
  const v = BigInt(value);
  const res = (v >> BigInt(7)) ^ ((v << BigInt(25)) & _U32_MASK) ^
              (v >> BigInt(18)) ^ ((v << BigInt(14)) & _U32_MASK) ^
              (v >> BigInt(3));
  return Number(res & _U32_MASK);
}

function sigma1(value: number): number {
  const v = BigInt(value);
  const res = (v >> BigInt(17)) ^ ((v << BigInt(15)) & _U32_MASK) ^
              (v >> BigInt(19)) ^ ((v << BigInt(13)) & _U32_MASK) ^
              (v >> BigInt(10));
  return Number(res & _U32_MASK);
}

function sha256Rounds(state: number[], words: number[], firstRound = 0): number[] {
  let [a, b, c, d, e, f, g, h] = state.map(x => BigInt(x) & _U32_MASK);
  const constants = (firstRound === 14 ? _SHA256_BLOCK_CONSTANTS : _SHA256_ROUND_CONSTANTS).map(x => BigInt(x) & _U32_MASK);
  const mask = _U32_MASK;
  const mult = BigInt('0x100000001');

  const aligned = Math.min(64, Math.floor((firstRound + 7) / 8) * 8);
  for (let index = firstRound; index < aligned; index++) {
    const rotE = e * mult;
    const rotA = a * mult;
    const t1 = (h + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (g ^ (e & (f ^ g))) + constants[index] + (BigInt(words[index]) & mask)) & mask;
    const t2 = (((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((a & b) | (c & (a | b)))) & mask;
    const newA = (t1 + t2) & mask;
    const newE = (d + t1) & mask;
    h = g; g = f; f = e; e = newE;
    d = c; c = b; b = a; a = newA;
  }

  for (let index = aligned; index < 64; index += 8) {
    let rotE = e * mult; let rotA = a * mult;
    let t1 = (h + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (g ^ (e & (f ^ g))) + constants[index] + (BigInt(words[index]) & mask)) & mask;
    d = (d + t1) & mask;
    h = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((a & b) | (c & (a | b)))) & mask;

    rotE = d * mult; rotA = h * mult;
    t1 = (g + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (f ^ (d & (e ^ f))) + constants[index + 1] + (BigInt(words[index + 1]) & mask)) & mask;
    c = (c + t1) & mask;
    g = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((h & a) | (b & (h | a)))) & mask;

    rotE = c * mult; rotA = g * mult;
    t1 = (f + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (e ^ (c & (d ^ e))) + constants[index + 2] + (BigInt(words[index + 2]) & mask)) & mask;
    b = (b + t1) & mask;
    f = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((g & h) | (a & (g | h)))) & mask;

    rotE = b * mult; rotA = f * mult;
    t1 = (e + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (d ^ (b & (c ^ d))) + constants[index + 3] + (BigInt(words[index + 3]) & mask)) & mask;
    a = (a + t1) & mask;
    e = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((f & g) | (h & (f | g)))) & mask;

    rotE = a * mult; rotA = e * mult;
    t1 = (d + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (c ^ (a & (b ^ c))) + constants[index + 4] + (BigInt(words[index + 4]) & mask)) & mask;
    h = (h + t1) & mask;
    d = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((e & f) | (g & (e | f)))) & mask;

    rotE = h * mult; rotA = d * mult;
    t1 = (c + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (b ^ (h & (a ^ b))) + constants[index + 5] + (BigInt(words[index + 5]) & mask)) & mask;
    g = (g + t1) & mask;
    c = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((d & e) | (f & (d | e)))) & mask;

    rotE = g * mult; rotA = c * mult;
    t1 = (b + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (a ^ (g & (h ^ a))) + constants[index + 6] + (BigInt(words[index + 6]) & mask)) & mask;
    f = (f + t1) & mask;
    b = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((c & d) | (e & (c | d)))) & mask;

    rotE = f * mult; rotA = b * mult;
    t1 = (a + ((rotE >> BigInt(6)) ^ (rotE >> BigInt(11)) ^ (rotE >> BigInt(25))) + (h ^ (f & (g ^ h))) + constants[index + 7] + (BigInt(words[index + 7]) & mask)) & mask;
    e = (e + t1) & mask;
    a = (t1 + ((rotA >> BigInt(2)) ^ (rotA >> BigInt(13)) ^ (rotA >> BigInt(22))) + ((b & c) | (d & (b | c)))) & mask;
  }

  return [Number(a), Number(b), Number(c), Number(d), Number(e), Number(f), Number(g), Number(h)];
}

function expandSha256Schedule(words: number[], firstWord = 16): void {
  const mask = _U32_MASK;
  for (let index = firstWord; index < 64; index++) {
    const x = BigInt(words[index - 2]);
    const y = BigInt(words[index - 15]);
    const s1 = (x >> BigInt(17)) ^ (x << BigInt(15)) ^ (x >> BigInt(19)) ^ (x << BigInt(13)) ^ (x >> BigInt(10));
    const s0 = (y >> BigInt(7)) ^ (y << BigInt(25)) ^ (y >> BigInt(18)) ^ (y << BigInt(14)) ^ (y >> BigInt(3));
    words.push(Number((s1 + BigInt(words[index - 7]) + s0 + BigInt(words[index - 16])) & mask));
  }
}

function sha256Init(data: Buffer): number[] {
  const mask = _U32_MASK;
  const word14 = (data[0] << 16) | (data[1] << 8) | data[2];
  const word15 = ((data[3] << 24) >>> 0) | (data[4] << 16) | (data[5] << 8) | data[6];

  const words = new Array(14).fill(0);
  words.push(word14);
  words.push(word15);

  for (let index = 16; index < 30; index++) {
    let value = BigInt(_SHA256_SCHEDULE[index - 16]);
    if (index - 2 >= 14) {
      const s1 = BigInt(sigma1(words[index - 2]));
      value += (index === 16 ? (s1 ^ BigInt(_SHA256_SIGMA1_ADJUSTMENT)) : s1);
    }
    if (index - 7 >= 14) {
      value += BigInt(words[index - 7]);
    }
    if (index - 15 >= 14) {
      const s0 = BigInt(sigma0(words[index - 15]));
      value += (index === 29 ? (s0 ^ BigInt(_SHA256_SIGMA0_ADJUSTMENT)) : s0);
    }
    words.push(Number(value & mask));
  }

  const w30 = (BigInt(sigma1(words[28])) + BigInt(words[23]) + BigInt(sigma0(words[15])) + BigInt(words[14]) + BigInt(_SHA256_ADJUSTMENT) - BigInt(_SHA256_ROUND_CONSTANTS[14])) & mask;
  words.push(Number(w30));

  expandSha256Schedule(words, 31);
  const working = sha256Rounds(_SHA256_STATE, words, 14);
  return _SHA256_INITIAL.map((x, i) => Number((BigInt(x) + BigInt(working[i])) & mask));
}

function sha256Digest(data: Buffer): Buffer {
  if (data.length < 7) throw new Error('Token salt must contain >= 7 bytes');
  const mask = _U32_MASK;
  const length = 57 + data.length;
  const padLen = ((55 - length) % 64 + 64) % 64;
  const lenBuf = Buffer.alloc(8);
  lenBuf.writeBigUInt64BE(BigInt(length * 8));

  const padded = Buffer.concat([
    data.slice(7),
    Buffer.from([0x80]),
    Buffer.alloc(padLen),
    lenBuf
  ]);

  let state = sha256Init(data.slice(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let w = 0; w < 64; w += 4) {
      words.push(padded.readUInt32BE(offset + w));
    }
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    state = state.map((x, i) => Number((BigInt(x) + BigInt(working[i])) & mask));
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32BE(state[i], i * 4);
  }
  return out;
}

function cs64Digest(data: Buffer, digest: Buffer): [number, number] {
  const mask = _U32_MASK;
  const keyA = BigInt(digest.readUInt32LE(0)) | BigInt(1);
  const keyB = BigInt(digest.readUInt32LE(4)) | BigInt(1);
  const factor = BigInt(_CS64_FACTOR);

  const factors = [
    (keyA * factor) & mask,
    (keyB * factor) & mask
  ];

  const terms = _CS64_COEFFICIENTS.map(([coef, _], idx) => {
    return Number((BigInt(coef) * factors[idx % 2]) & mask);
  });
  const offsets = _CS64_COEFFICIENTS.map(([_, off]) => off);

  const evenWords = wordsLe4Even(Buffer.concat([Buffer.from([0]), data]));
  for (let idx = 0; idx < evenWords.length; idx++) {
    const word = BigInt(evenWords[idx]);
    let term = (word * (idx % 2 === 0 ? keyA : keyB)) & mask;
    const offMul = (idx % 2 === 0 ? BigInt('0xEF0569FB') : BigInt('0xC31713DB'));
    let offset = (BigInt(rol16(Number(word))) * offMul) & mask;

    if (idx === 0) {
      term = (term + BigInt(_CS64_ADJUSTMENT0) * factors[0]) & mask;
      offset = (offset + BigInt(_CS64_ADJUSTMENT1)) & mask;
    }
    terms.push(Number(term & mask));
    offsets.push(Number(offset & mask));
  }

  let swapAcc = BigInt(0);
  let swapLast = BigInt(0);
  let state = BigInt(0);
  let acc = BigInt(0);

  for (let idx = 0; idx < terms.length; idx += 2) {
    const x = BigInt(terms[idx]);
    const y = BigInt(terms[idx + 1]);

    let t = BigInt(rol16(Number((BigInt(offsets[idx]) + x) & mask)));
    let q = (t * BigInt('0x76F50F34')) & mask;
    swapAcc = (swapAcc + BigInt(rol16(Number(q))) * BigInt('0xC3EFEA97') + q) & mask;

    t = BigInt(rol16(Number((BigInt(offsets[idx + 1]) + y) & mask)));
    q = (t * BigInt('0x1881CE3C')) & mask;
    swapLast = (BigInt(rol16(Number(q))) * BigInt('0x35BD1EC9') + q) & mask;
    swapAcc = (swapAcc + swapLast) & mask;

    state = (state * keyA + x) & mask;
    state = (BigInt(rol16(Number(state))) * BigInt('0xCF98B111')) & mask;
    state = (BigInt(rol16(Number(state))) * BigInt('0x87085B9F')) & mask;
    state = (BigInt(rol16(Number(state))) * BigInt('0x12CEB96D')) & mask;
    state = (BigInt(rol16(Number(state))) * BigInt('0x257E1D83')) & mask;
    acc = (acc + state) & mask;

    t = (state * keyB + y) & mask;
    t = (BigInt(rol16(Number(t))) * BigInt('0xA27416F5')) & mask;
    t = (BigInt(rol16(Number(t))) * BigInt('0xD38396FF')) & mask;
    state = (BigInt(rol16(Number((BigInt(rol16(Number(t))) * BigInt('0x7C932B89')) & mask))) * BigInt('0xBFA49F69')) & mask;
    acc = (acc + state) & mask;
  }

  return [
    Number((swapLast ^ state) & mask),
    Number((swapAcc ^ acc) & mask)
  ];
}

export function generateSecMsGecV2(unixTimestamp?: number): string {
  let ticks = unixTimestamp !== undefined ? Number(unixTimestamp) : Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= S_TO_NS / 100;

  const strToHash = `${Math.floor(ticks)}${TRUSTED_CLIENT_TOKEN}`;
  const data = Buffer.from(strToHash, 'ascii');

  const digest = sha256Digest(data);
  const [cs0, cs1] = cs64Digest(data, digest);
  const csBuf = Buffer.alloc(8);
  csBuf.writeUInt32LE(cs0, 0);
  csBuf.writeUInt32LE(cs1, 4);

  const cs64Hex = csBuf.toString('hex').toUpperCase();
  const sha256Hex = digest.toString('hex').toUpperCase();

  return `${cs64Hex}-${sha256Hex}`;
}

/**
 * Pure Node.js Edge-TTS synthesizer with Sec-MS-GEC v2 DRM support.
 * Runs anywhere (Vercel, local Node, AWS, etc.) without Python!
 */
export function synthesizeEdgeTTS(
  text: string,
  voice: string = 'hi-IN-MadhurNeural',
  rate: string = '+4%',
  pitch: string = '+2Hz'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const connId = crypto.randomBytes(16).toString('hex');
    const token = generateSecMsGecV2();
    const url = `${WSS_URL}&ConnectionId=${connId}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=2-143.0.3650.75`;
    const muid = crypto.randomBytes(16).toString('hex').toUpperCase();

    const ws = new WebSocket(url, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Sec-WebSocket-Version': '13',
        Cookie: `muid=${muid};`,
      },
    });

    const audioChunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch (_) {}
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      } else {
        reject(new Error('TTS timeout: No audio received within 10s'));
      }
    }, 10000);

    ws.on('open', () => {
      const nowStr = new Date().toISOString();
      const configMsg =
        `X-Timestamp:${nowStr}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'false',
                },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        });
      ws.send(configMsg);

      const requestId = crypto.randomBytes(16).toString('hex');
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${pitch}' rate='${rate}'>` +
        text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        `</prosody>` +
        `</voice>` +
        `</speak>`;

      const ssmlMsg =
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${nowStr}\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
      ws.send(ssmlMsg);
    });

    ws.on('message', (data: any, isBinary: boolean) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length > 2) {
          const headerLen = buf.readUInt16BE(0);
          const audioData = buf.subarray(headerLen + 2);
          if (audioData.length > 0) {
            audioChunks.push(audioData);
          }
        }
      } else {
        const textMsg = data.toString('utf8');
        if (textMsg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          ws.close();
          resolve(Buffer.concat(audioChunks));
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      } else {
        reject(err);
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      if (audioChunks.length > 0) {
        resolve(Buffer.concat(audioChunks));
      }
    });
  });
}
