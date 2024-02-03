import { GenericConstant } from "./constants";
import { Upvalue } from "./upvalues";
import { Script } from "./script";
import { Code } from "./code";

export enum PrototypeFlags {
  None          = 0,
  HasChildren   = 1 << 0,
  VarArg        = 1 << 1,
  FFIConstants  = 1 << 2,
  NoJIT         = 1 << 3,

  // Have loops that cannot be JIT compiled, so they're
  //  force interpreted
  HaveILOOP     = 1 << 4
};

export class PrototypeLocalDebugInfo {
  scopeBegin: number
  scopeLength: number
  name: string
  
  // Used in saving if variable is internal
  special: number

  constructor() {
    this.scopeBegin = 0;
    this.scopeLength = 0;
    this.special = 0;
    this.name = "";
  }
};

export class PrototypeDebugInfo {
  firstLine: number
  linesCount: number
  
  lines: number[]
  upvalues: string[]
  locals: PrototypeLocalDebugInfo[]

  constructor() {
    this.firstLine = 0;
    this.linesCount = 0;

    this.lines = [];
    this.upvalues = [];
    this.locals = [];
  }

  getLine(address: number): number {
    return this.lines[address];
  }

  getUpvalueName(index: number): string {
    return this.upvalues[index];
  }

  getVariableName(address: number, index: number): string {
    let lastpc = 0;
    for (const local of this.locals) {
      const beginpc = lastpc + local.scopeBegin;
      lastpc = beginpc;
      const endpc = beginpc + local.scopeLength;

      if (beginpc > address)
        break;

      if (address < endpc) {
        if (index === 0)
          return local.name;
        else
          --index;
      }
    }
    
    return "";
  }
}

export class Prototype {
  script: Script
  flags: PrototypeFlags
  argsCount: number
  maxSlot: number
  debugInfo?: PrototypeDebugInfo
  code: Code
  upvalues: Upvalue[]
  constants: GenericConstant[]
  numbers: number[]
  parent?: Prototype
  children: Prototype[]

  constructor(script: Script) {
    this.script = script;
    this.flags = 0;
    this.argsCount = 0;
    this.maxSlot = 0;
    this.debugInfo = undefined;
    this.code = new Code();
    this.upvalues = [];
    this.constants = [];
    this.numbers = [];
    this.parent = undefined;
    this.children = [];
  }
};
