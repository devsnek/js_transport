import {
  FORMAT_VERSION,
  NULL_EXT,
  UNDEFINED_EXT,
  BOOLEAN_EXT,
  NUMBER_EXT,
  BIGINT_EXT,
  STRING_EXT,
  OBJECT_EXT,
  ARRAY_EXT,
  MAP_EXT,
  SET_EXT,
  DATE_EXT,
  REGEXP_EXT,

  // REGEXP_FLAG_NONE,
  REGEXP_FLAG_GLOBAL,
  REGEXP_FLAG_IGNORECASE,
  REGEXP_FLAG_MULTILINE,
  REGEXP_FLAG_STICKY,
  REGEXP_FLAG_UNICODE,
  REGEXP_FLAG_DOTALL,
} from './constants';

export default class Decoder {
  constructor(buffer, checkVersion = true) {
    this.buffer = new Uint8Array(buffer);
    this.view = new DataView(this.buffer.buffer);
    this.offset = 0;
    this.decoder = new TextDecoder('utf8');
    if (checkVersion) {
      const version = this.read8();
      if (version !== FORMAT_VERSION) {
        throw new Error('invalid version header');
      }
    }
  }

  read8() {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  read16() {
    const val = this.view.getUint16(this.offset);
    this.offset += 2;
    return val;
  }

  read32() {
    const val = this.view.getUint32(this.offset);
    this.offset += 4;
    return val;
  }

  read64() {
    const val = this.view.getFloat64(this.offset);
    this.offset += 8;
    return val;
  }

  unpack() {
    const type = this.read8();
    switch (type) {
      case NULL_EXT:
        return null;
      case UNDEFINED_EXT:
        return undefined;
      case BOOLEAN_EXT:
        return Boolean(this.read8());
      case NUMBER_EXT: {
        return this.read64();
      }
      case BIGINT_EXT: {
        const sign = this.read8();
        const digits = this.read32();

        let value = 0n;
        let b = 1n;

        for (let i = 0; i < digits; i += 1) {
          const digit = this.read8();
          value += BigInt(digit) * b;
          b <<= 8n;
        }

        return sign === 0 ? value : -value;
      }
      case STRING_EXT: {
        const length = this.read32();
        const slice = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return this.decoder.decode(slice);
      }
      case MAP_EXT: {
        const size = this.read32();
        const map = new Map();
        for (let i = 0; i < size; i += 1) {
          map.set(this.unpack(), this.unpack());
        }
        return map;
      }
      case SET_EXT: {
        const size = this.read32();
        const set = new Set();
        for (let i = 0; i < size; i += 1) {
          set.add(this.unpack());
        }
        return set;
      }
      case DATE_EXT: {
        return new Date(this.read64());
      }
      case REGEXP_EXT: {
        const flagsRaw = this.read8();

        let flags = '';
        if (flagsRaw & REGEXP_FLAG_GLOBAL) {
          flags += 'g';
        }
        if (flagsRaw & REGEXP_FLAG_IGNORECASE) {
          flags += 'i';
        }
        if (flagsRaw & REGEXP_FLAG_MULTILINE) {
          flags += 'm';
        }
        if (flagsRaw & REGEXP_FLAG_STICKY) {
          flags += 'y';
        }
        if (flagsRaw & REGEXP_FLAG_UNICODE) {
          flags += 'u';
        }
        if (flagsRaw & REGEXP_FLAG_DOTALL) {
          flags += 's';
        }

        const length = this.read32();
        const slice = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        const source = this.decoder.decode(slice);

        return new RegExp(source, flags);
      }
      case ARRAY_EXT: {
        const length = this.read32();
        const array = new Array(length);
        for (let i = 0; i < length; i += 1) {
          array[i] = this.unpack();
        }
        return array;
      }
      case OBJECT_EXT: {
        const size = this.read32();
        const object = {};
        for (let i = 0; i < size; i += 1) {
          object[this.unpack()] = this.unpack();
        }
        return object;
      }
      default:
        throw new Error('unsupported type');
    }
  }
}
