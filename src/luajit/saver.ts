import Complex from "complex";

import { Table, TableValue, TableValueType } from "./tables";
import { Prototype, PrototypeDebugInfo } from "./prototype";
import { GenericConstantType } from "./constants";
import { Script, ScriptFlags } from "./script";
import { getOpcodeInfo } from "./opcodes";
import { ByteStream } from "../utils/bytestream";
import { bitCast } from "../utils/numbers";

export class ScriptSaver {
  private scr: Script;
  private bs: ByteStream;

  constructor(script: Script) {
    this.scr = script;
    this.bs = new ByteStream();
  }

  getResult(): Buffer {
    return this.bs.data();
  }

  private hasDebug(): boolean {
    return !(this.scr.flags & ScriptFlags.StripDebug);
  }

  private saveHeader() {
    this.bs.writeu8(this.scr.bytecodeVersion);
    this.bs.writeULEB128(this.scr.flags);

    if (this.hasDebug()) {
      const chunkname = this.scr.chunkname;
      this.bs.writeULEB128(chunkname.length);
      this.bs.writeString(chunkname);
    }
  }

  private saveTableValue(value: TableValue) {
    const type = value.type;

    if (type === TableValueType.String) {
      const v = value.value as string;
      this.bs.writeULEB128(type + v.length);
      this.bs.writeString(v);
    }

    this.bs.writeULEB128(type);

    switch (type) {
      case TableValueType.Int32: {
        const v = value.value as bigint;
        this.bs.writeULEB128(Number(v));
      } break;
      case TableValueType.Int64: {
        const v = value.value as bigint;
        this.bs.writeULEB128(Number(v & 0xFFFFFFFFn));
        this.bs.writeULEB128(Number(v >> 32n));
      } break;
    }
  }

  private saveTable(table: Table) {
    const array = table.array();
    const dict = table.dictionary();

    this.bs.writeULEB128(array.length);
    this.bs.writeULEB128(dict.length);

    for (const item of array) {
      this.saveTableValue(item);
    }
    
    for (const node of dict) {
      this.saveTableValue(node.key);
      this.saveTableValue(node.value);
    }
  }

  private savePrototype(proto: Prototype) {
    for (let i = proto.children.length - 1; i >= 0; --i)
      this.savePrototype(proto.children[i]);

    // create separate bytestream for this prototype
    const savedBs = this.bs;
    this.bs = new ByteStream();

    this.bs.writeu8(proto.flags);
    this.bs.writeu8(proto.argsCount);
    this.bs.writeu8(proto.maxSlot);

    this.bs.writeu8(proto.upvalues.length);
    this.bs.writeULEB128(proto.constants.length);
    this.bs.writeULEB128(proto.numbers.length);
    this.bs.writeULEB128(proto.code.instructions.length);

    const dbgBs = new ByteStream();

    if (this.hasDebug()) {
      const debugInfo = proto.debugInfo as PrototypeDebugInfo;

      let lineNumSize = 1;
      if (debugInfo.linesCount > 255)
        lineNumSize = 2;
      else if (debugInfo.linesCount > 65535)
        lineNumSize = 4;
      
      for (const line of debugInfo.lines) {
        dbgBs.writeu(line, lineNumSize);
      }

      for (const upvalue of debugInfo.upvalues) {
        dbgBs.writeString(upvalue);
        dbgBs.writeu8(0);
      }

      for (const local of debugInfo.locals) {
        if (local.special !== 0) {
          dbgBs.writeu8(local.special);
        } else {
          dbgBs.writeString(local.name);
          dbgBs.writeu8(0);
        }

        dbgBs.writeULEB128(local.scopeBegin);
        dbgBs.writeULEB128(local.scopeLength);
      }

      this.bs.writeULEB128(dbgBs.size()); // dbgsize
      this.bs.writeULEB128(proto.debugInfo?.firstLine as number);
      this.bs.writeULEB128(proto.debugInfo?.linesCount as number);
    }

    for (const inst of proto.code.instructions) {
      const info = getOpcodeInfo(inst.opcode);
      let value = 0;
      value |= inst.opcode;

      if (info.canA())
        value |= (inst.A() & 0xFF) << 8;

      if (info.canB())
        value |= (inst.B() & 0xFF) << 24;

      if (info.canC())
        value |= (inst.C() & 0xFF) << 16;

      if (info.canD())
        value |= (inst.D() & 0xFFFF) << 16;
    
      // shitty js fucks up simple bitwise operations
      // this is a crutch to convert negative numbers to positives
      value >>>= 0;

      this.bs.writeu32(value);
    }

    for (const upvalue of proto.upvalues) {
      this.bs.writeu16(upvalue.compress());
    }

    for (let i = proto.constants.length - 1; i >= 0; --i) {
      const constant = proto.constants[i];
      const type = constant.type;

      if (type === GenericConstantType.String) {
        const value = constant.value as string;
        this.bs.writeULEB128(type + value.length);
        this.bs.writeString(value);
        continue;
      }

      this.bs.writeULEB128(type);

      switch (type) {
        case GenericConstantType.Child: break;
        case GenericConstantType.Table:
          this.saveTable(constant.value as Table);
          break;
        case GenericConstantType.Int64:
        case GenericConstantType.Uint64: {
          const value = constant.value as bigint;
          const low = value & 0xFFFFFFFFn;
          const high = value >> 32n;
          this.bs.writeULEB128(Number(low));
          this.bs.writeULEB128(Number(high));
        } break;
        case GenericConstantType.Complex: {
          const value = constant.value as Complex;

          const real = bitCast("double", value.real, "uint64");
          const imag = bitCast("double", value.im, "uint64");

          this.bs.writeULEB128(Number(real & 0xFFFFFFFFn));
          this.bs.writeULEB128(Number(real >> 32n));
          this.bs.writeULEB128(Number(imag & 0xFFFFFFFFn));
          this.bs.writeULEB128(Number(imag >> 32n));
        } break;
      }
    }

    for (let i = proto.numbers.length - 1; i >= 0; --i) {
      const number = proto.numbers[i];

      if (number % 1 === 0) {
        // if int
        this.bs.writeULEB128_33(false, number);
      } else {
        // if float
        const value = bitCast("double", number, "uint64");
        
        this.bs.writeULEB128_33(true, Number(value & 0xFFFFFFFFn));
        this.bs.writeULEB128(Number(value >> 32n));
      }
    }

    if (dbgBs.size() > 0) {
      this.bs.writeBs(dbgBs);
    }

    // restore bytestream
    savedBs.writeULEB128(this.bs.size());
    savedBs.writeBs(this.bs);
    this.bs = savedBs;
  }

  save() {
    this.bs.seek(0);
    
    this.bs.writeString("\x1BLJ");
    this.saveHeader();

    this.savePrototype(this.scr.global);
    this.bs.writeu8(0);
  }
};
