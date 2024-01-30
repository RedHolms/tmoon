export class Upvalue {
  index: number
  isReadonly: boolean
  isLocal: boolean

  constructor(value: number) {
    this.index = value & 0x3FFF;
    this.isReadonly = (value & 0x4000) !== 0;
    this.isLocal = (value & 0x8000) !== 0;
  }

  compress(): number {
    return this.index | (this.isReadonly ? 0x4000 : 0) | (this.isLocal ? 0x8000 : 0);
  }
};
