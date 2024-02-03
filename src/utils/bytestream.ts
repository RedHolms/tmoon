import os from "node:os";

export class ByteStream {
  public endianness: "BE" | "LE"

  private m_data: Buffer
  private m_p: number
  private m_size: number

  constructor();
  constructor(data: Buffer);

  constructor(data?: Buffer) {
    this.m_p = 0;
    this.m_size = 0;

    if (data === undefined) {
      data = Buffer.alloc(16);
    } else {
      this.m_size = data.length;
    }

    this.m_data = data;

    this.endianness = os.endianness();
  }

  // actually don't clears anything
  clear() {
    this.m_size = 0;
  }

  // get pointer
  tell(): number {
    return this.m_p;
  }

  // set pointer
  seek(value: number) {
    this.m_p = value;
  }

  // get data
  data(): Buffer {
    const result = Buffer.alloc(this.m_size);
    this.m_data.copy(result, 0, 0, this.m_size);
    return result;
  }

  // get data size
  size(): number {
    return this.m_size;
  }

  // get allocated space
  allocated(): number {
    return this.m_data.length;
  }

  // add value to pointer
  skip(bytes: number) {
    this.m_p += bytes;
  }

  // read signed int
  readi(bytes: number): number {
    const last = this.m_p + bytes - 1;

    if (last >= this.m_size)
      throw new Error("out of range");

    let value;

    if (this.endianness === "BE")
      value = this.m_data.readIntBE(this.m_p, bytes);
    else
      value = this.m_data.readIntLE(this.m_p, bytes);

    this.skip(bytes);
    return value;
  }

  // read unsigned int
  readu(bytes: number): number {
    const last = this.m_p + bytes - 1;

    if (last >= this.m_size)
      throw new Error("out of range");

    let value;
    
    if (this.endianness === "BE")
      value = this.m_data.readUIntBE(this.m_p, bytes);
    else
      value = this.m_data.readUIntLE(this.m_p, bytes);

    this.skip(bytes);
    return value;
  }

  readi8(): number {
    return this.readi(1);
  }

  readu8(): number {
    return this.readu(1);
  }

  readi16(): number {
    return this.readi(2);
  }

  readu16(): number {
    return this.readu(2);
  }

  readi32(): number {
    return this.readi(4);
  }

  readu32(): number {
    return this.readu(4);
  }

  // read compressed u32
  readULEB128(): number {
    let value = this.readu8();

    if (value >= 0x80) {
      let shift = 7;
      value &= 0x7F;
      let byte;
      do {
        byte = this.readu8();
        value |= (byte & 0x7F) << shift;
        shift += 7;
      } while (byte >= 0x80);
    }

    return value;
  }

  // read compressed u32 with 1 extra bit mark
  readULEB128_33(): [ boolean, number ] {
    let value = this.readu8();

    const mark = (value & 1) !== 0;
    value >>= 1;

    if (value >= 0x40) {
      let shift = 6;
      value &= 0x3F;
      let byte;
      do {
        byte = this.readu8();
        value |= (byte & 0x7F) << shift;
        shift += 7;
      } while (byte >= 0x80);
    }

    return [ mark, value ];
  }

  // read binary string
  readString(length: number): string {
    const last = this.m_p + length - 1;

    if (last >= this.m_size)
      throw new Error("out of range");

    const value = this.m_data.toString(undefined, this.m_p, this.m_p + length);

    this.skip(length);
    return value;
  }

  private reallocate(newSize: number) {
    if (newSize < this.m_size)
      newSize = this.m_size;

    const prevData = this.m_data;
    this.m_data = Buffer.alloc(newSize);

    if (prevData.length > 0) {
      prevData.copy(this.m_data, 0, 0, this.m_size);
    }
  }

  private grow(required: number) {
    const allocated = this.allocated();
    let newSize = allocated + (allocated / 2);
    if (newSize < required)
      newSize = required;
    this.reallocate(newSize);
  }

  private wantWrite(bytes: number) {
    const reqsize = this.m_p + bytes ;

    if (reqsize > this.allocated())
      this.grow(reqsize);

    if (reqsize > this.m_size)
      this.m_size = reqsize;
  }

  writei(value: number, bytes: number) {
    this.wantWrite(bytes);

    if (this.endianness === "BE")
      this.m_data.writeIntBE(value, this.m_p, bytes);
    else
      this.m_data.writeIntLE(value, this.m_p, bytes);

    this.skip(bytes);
  }

  writeu(value: number, bytes: number) {
    this.wantWrite(bytes);

    if (this.endianness === "BE")
      this.m_data.writeUintBE(value, this.m_p, bytes);
    else
      this.m_data.writeUintLE(value, this.m_p, bytes);

    this.skip(bytes);
  }

  writei8(value: number) {
    return this.writei(value, 1);
  }

  writeu8(value: number) {
    return this.writeu(value, 1);
  }

  writei16(value: number) {
    return this.writei(value, 2);
  }

  writeu16(value: number) {
    return this.writeu(value, 2);
  }

  writei32(value: number) {
    return this.writei(value, 4);
  }

  writeu32(value: number) {
    return this.writeu(value, 4);
  }

  writeULEB128(value: number) {
    while (value >= 0x80) {
      this.writeu8((value & 0x7F) | 0x80);
      value >>= 7;
    }
    this.writeu8(value);
  }

  writeULEB128_33(mark: boolean, value: number) {
    value <<= 1;
    if (mark)
      value += 1;
    this.writeULEB128(value);
  }

  writeString(value: string) {
    const size = value.length;

    this.wantWrite(size);
    this.m_data.write(value, this.m_p);
    this.skip(size);
  }

  writeBs(value: ByteStream) {
    const size = value.size();

    this.wantWrite(size);
    value.m_data.copy(this.m_data, this.m_p, 0, size);
    this.skip(size);
  }
};
