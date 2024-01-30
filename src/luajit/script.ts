import fs from "node:fs";

import { Prototype } from "./prototype";
import { ScriptParser } from "./parser";
import { ScriptSaver } from "./saver";

export enum ScriptFlags {
  None        = 0,
  BigEndian   = 1 << 0,
  StripDebug  = 1 << 1,
  UseFFI      = 1 << 2
};

export class Script {
  bytecodeVersion: number
  flags: ScriptFlags
  chunkname: string
  global: Prototype

  constructor();
  constructor(filename: string);

  constructor(filename?: string) {
    this.bytecodeVersion = 2;
    this.flags = ScriptFlags.BigEndian | ScriptFlags.StripDebug;
    this.chunkname = "?";
    this.global = new Prototype(this);

    if (filename !== undefined)
      this.loadFrom(filename);
  }

  loadFrom(data: Buffer): void;
  loadFrom(filename: string): void;
  loadFrom(arg: Buffer | string) {
    if (typeof arg == "string")
      this.loadFromFile(arg);
    else
      this.loadFromBuffer(arg);
  }

  save(): Buffer {
    const saver = new ScriptSaver(this);
    saver.save();
    return saver.getResult();
  }

  private loadFromFile(filename: string) {
    const data = fs.readFileSync(filename);
    this.loadFromBuffer(data);
  }

  private loadFromBuffer(data: Buffer) {
    const parser = new ScriptParser(this, data);
    parser.parse();
  }
};
