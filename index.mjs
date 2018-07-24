import Encoder from './src/encoder';
import Decoder from './src/decoder';

export function pack(v) {
  const encoder = new Encoder();
  encoder.pack(v);
  return encoder.buffer.slice(0, encoder.offset);
}

export function unpack(v) {
  const decoder = new Decoder(v);
  return decoder.unpack();
}
