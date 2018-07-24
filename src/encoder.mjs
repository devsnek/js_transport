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

  REGEXP_FLAG_NONE,
  REGEXP_FLAG_GLOBAL,
  REGEXP_FLAG_IGNORECASE,
  REGEXP_FLAG_MULTILINE,
  REGEXP_FLAG_STICKY,
  REGEXP_FLAG_UNICODE,
  REGEXP_FLAG_DOTALL,
} from './constants';

const { isArray } = Array;

/* eslint-disable no-plusplus */

const BUFFER_CHUNK = 1024;

export default class Encoder {
  constructor() {
    this.buffer = new Uint8Array(BUFFER_CHUNK);
    this.view = new DataView(this.buffer.buffer);
    this.encoder = new TextEncoder();
    this.buffer[0] = FORMAT_VERSION;
    this._offset = 1;
  }

  grow(length) {
    if (this._offset + length < this.buffer.length) {
      return;
    }
    const chunks = Math.ceil((length || 1) / BUFFER_CHUNK) * BUFFER_CHUNK;
    const old = this.buffer;
    this.buffer = new Uint8Array(old.length + chunks);
    this.buffer.set(old);
    this.view = new DataView(this.buffer.buffer);
  }

  set offset(v) {
    this.grow(v);
    this._offset = v;
  }

  get offset() {
    return this._offset;
  }

  pack(value) {
    if (value === null) {
      this.buffer[this.offset++] = NULL_EXT;
      return;
    }

    if (value === undefined) {
      this.buffer[this.offset++] = UNDEFINED_EXT;
    }

    if (typeof value === 'boolean') {
      this.buffer[this.offset++] = BOOLEAN_EXT;
      this.buffer[this.offset++] = value ? 1 : 0;
      return;
    }

    if (typeof value === 'number') {
      this.buffer[this.offset++] = NUMBER_EXT;
      this.offset += 8;
      this.view.setFloat64(this.offset - 8, value);
      return;
    }

    if (typeof value === 'bigint') { // eslint-disable-line valid-typeof
      this.buffer[this.offset++] = BIGINT_EXT;

      const sign = value > 0n ? 0 : 1;
      this.buffer[this.offset++] = sign;

      let ull = sign === 1 ? -value : value;
      let byteCount = 0;


      const byteCountIndex = this.offset;
      this.offset += 4;

      while (ull > 0) {
        byteCount += 1;
        this.buffer[this.offset++] = Number(ull & 0xFFn);
        ull >>= 8n;
      }

      this.view.setUint32(byteCountIndex, byteCount);

      return;
    }

    if (typeof value === 'string') {
      this.buffer[this.offset++] = STRING_EXT;
      this.offset += 4;
      this.view.setUint32(this.offset - 4, value.length);
      const a = this.encoder.encode(value);
      this.offset += a.length;
      this.buffer.set(a, this.offset - a.length);
      return;
    }

    if (value instanceof Date) {
      this.buffer[this.offset++] = DATE_EXT;

      this.offset += 8;
      this.view.setFloat64(this.offset - 8, value.getTime());

      return;
    }

    if (value instanceof RegExp) {
      this.buffer[this.offset++] = REGEXP_EXT;

      let flags = REGEXP_FLAG_NONE;
      if (value.global) {
        flags |= REGEXP_FLAG_GLOBAL;
      }
      if (value.ignoreCase) {
        flags |= REGEXP_FLAG_IGNORECASE;
      }
      if (value.multiline) {
        flags |= REGEXP_FLAG_MULTILINE;
      }
      if (value.sticky) {
        flags |= REGEXP_FLAG_STICKY;
      }
      if (value.unicode) {
        flags |= REGEXP_FLAG_UNICODE;
      }
      if (value.dotAll) {
        flags |= REGEXP_FLAG_DOTALL;
      }

      this.buffer[this.offset++] = flags;

      const { source } = value;
      this.offset += 4;
      this.view.setUint32(this.offset - 4, source.length);
      const a = this.encoder.encode(source);
      this.offset += a.length;
      this.buffer.set(a, this.offset - a.length);
      return;
    }

    if (value instanceof Map) {
      this.buffer[this.offset++] = MAP_EXT;
      const { size } = value;
      this.offset += 4;
      this.view.setUint32(this.offset - 4, size);
      for (const [k, v] of value) {
        this.pack(k);
        this.pack(v);
      }
    }

    if (value instanceof Set) {
      this.buffer[this.offset++] = SET_EXT;
      const { size } = value;
      this.offset += 4;
      this.view.setUint32(this.offset - 4, size);
      for (const v of value) {
        this.pack(v);
      }
      return;
    }

    if (isArray(value)) {
      const { length } = value;
      this.buffer[this.offset++] = ARRAY_EXT;
      this.offset += 4;
      this.view.setUint32(this.offset - 4, length);
      value.forEach((v) => {
        this.pack(v);
      });
      return;
    }

    if (typeof value === 'object') {
      const properties = Object.getOwnPropertyNames(value);
      this.buffer[this.offset++] = OBJECT_EXT;
      this.view.setUint32(this.offset, properties.length);
      this.offset += 4;
      properties.forEach((p) => {
        this.pack(p);
        this.pack(value[p]);
      });
      return;
    }

    throw new Error('could not pack value');
  }
}
