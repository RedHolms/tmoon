import { ByteStream } from "./bytestream";

export class TextStream {
  private m_bs: ByteStream

  constructor() {
    this.m_bs = new ByteStream();
  }
};

