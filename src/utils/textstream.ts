import { ByteStream } from "./bytestream";

export class TextStream {
  private bs: ByteStream;

  constructor(data: string, encoding?: BufferEncoding);
  constructor(data: Buffer);
  constructor();

  constructor(data?: string | Buffer, encoding?: BufferEncoding) {
    if (typeof data === "string") {

    }
    this.bs = new ByteStream();
  }
};

