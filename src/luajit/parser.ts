import Complex from "complex";

import { Prototype, PrototypeDebugInfo, PrototypeLocalDebugInfo } from "./prototype";
import { GenericConstant, GenericConstantType } from "./constants";
import { Table, TableValue, TableValueType } from "./tables";
import { Script, ScriptFlags } from "./script";
import { getOpcodeInfo } from "./opcodes";
import { Instruction } from "./code";
import { Upvalue } from "./upvalues";
import { bitCast, normalizeNumberSign } from "../utils/numbers";
import { ByteStream } from "../utils/bytestream";

export class ScriptParser {
  private m_s: Script;
  private m_bs: ByteStream;
  private m_stack: Prototype[];

  constructor(outScript: Script, data: Buffer) {
    this.m_s = outScript;
    this.m_bs = new ByteStream(data);
    this.m_stack = [];
  }

  private hasDebug(): boolean {
    return !(this.m_s.flags & ScriptFlags.StripDebug);
  }

  private parseHeader() {
    this.m_s.bytecodeVersion = this.m_bs.readu8();

    if (this.m_s.bytecodeVersion !== 2)
      throw Error("Only 2nd version of bytecode is supported");

    const flags = this.m_bs.readULEB128();
    this.m_s.flags = flags;

    if (this.hasDebug()) {
      const length = this.m_bs.readULEB128();
      this.m_s.chunkname = this.m_bs.readString(length);
    }
  }

  private parseTableValue(): TableValue {
    const type = this.m_bs.readULEB128();

    if (type >= TableValueType.String) {
      const length = type - TableValueType.String;
      const string = this.m_bs.readString(length);
      return new TableValue(TableValueType.String, string);
    } else if (type === TableValueType.Int64) {
      let value = BigInt(this.m_bs.readULEB128());
      value |= BigInt(this.m_bs.readULEB128()) << 32n;
      return new TableValue(type, normalizeNumberSign(value, 64));
    } else if (type === TableValueType.Int32) {
      const value = BigInt(this.m_bs.readULEB128());
      return new TableValue(type, normalizeNumberSign(value, 32));
    } else if (type === TableValueType.True) {
      return new TableValue(type, "true");
    } else if (type === TableValueType.False) {
      return new TableValue(type, "false");
    } else if (type === TableValueType.Nil) {
      return new TableValue(type, "nil");
    }

    throw Error("Invalid table value type");
  }

  private parseTable(): Table {
    const table = new Table();

    const arrayCount = this.m_bs.readULEB128();
    const dictCount = this.m_bs.readULEB128();

    for (let i = 0; i < arrayCount; ++i) {
      const value = this.parseTableValue();
      table.push(i, value);
    }

    for (let i = 0; i < dictCount; ++i) {
      const key = this.parseTableValue();
      const value = this.parseTableValue();
      table.set(key, value);
    }

    return table;
  }

  private parsePrototype() {
    /* prototype length */
    void this.m_bs.readULEB128();

    const prototype = new Prototype(this.m_s);
    
    prototype.flags = this.m_bs.readu8();
    prototype.argsCount = this.m_bs.readu8();
    prototype.maxSlot = this.m_bs.readu8();

    const uvcount = this.m_bs.readu8();
    const gkcount = this.m_bs.readULEB128();
    const nkcount = this.m_bs.readULEB128();
    const cdcount = this.m_bs.readULEB128();

    let dbgsize = 0;
    if (this.hasDebug()) {
      dbgsize = this.m_bs.readULEB128();

      prototype.debugInfo = new PrototypeDebugInfo();
      prototype.debugInfo.firstLine = this.m_bs.readULEB128();
      prototype.debugInfo.linesCount = this.m_bs.readULEB128();
    }

    for (let i = 0; i < cdcount; ++i) {
      const value = this.m_bs.readu32();
      const opcode = value & 0xFF;
      const info = getOpcodeInfo(opcode);

      const inst = new Instruction(opcode);
      
      if (info.canA())
        inst.A((value >>> 8) & 0xFF);

      if (info.canB())
        inst.B((value >>> 24) & 0xFF);

      if (info.canC())
        inst.C((value >>> 16) & 0xFF);

      if (info.canD())
        inst.D((value >>> 16) & 0xFFFF);

      prototype.code.push(inst);
    }

    for (let i = 0; i < uvcount; ++i) {
      const value = this.m_bs.readu16();
      prototype.upvalues.push(new Upvalue(value));
    }

    for (let i = 0; i < gkcount; ++i) {
      const type = this.m_bs.readULEB128();
      let constant;

      if (type >= GenericConstantType.String) {
        const length = type - GenericConstantType.String;
        const value = this.m_bs.readString(length);
        constant = new GenericConstant(GenericConstantType.String, value);
      } else if (type === GenericConstantType.Complex) {
        let real = BigInt(this.m_bs.readULEB128());
        real |= BigInt(this.m_bs.readULEB128()) << 32n;

        let imag = BigInt(this.m_bs.readULEB128());
        imag |= BigInt(this.m_bs.readULEB128()) << 32n;

        constant = new GenericConstant(
          GenericConstantType.Complex,
          new Complex(bitCast("uint64", real, "double"), bitCast("uint64", imag, "double"))
        );
      } else if (type === GenericConstantType.Uint64) {
        let value = BigInt(this.m_bs.readULEB128());
        value |= BigInt(this.m_bs.readULEB128()) << 32n;

        constant = new GenericConstant(type, value);
      } else if (type === GenericConstantType.Int64) {
        let value = BigInt(this.m_bs.readULEB128());
        value |= BigInt(this.m_bs.readULEB128()) << 32n;

        constant = new GenericConstant(type, normalizeNumberSign(value, 64));
      } else if (type === GenericConstantType.Table) {
        const table = this.parseTable();
        constant = new GenericConstant(GenericConstantType.Table, table);
      } else if (type === GenericConstantType.Child) {
        const child = this.m_stack.pop();

        if (child === undefined)
          throw Error("Prototype stack underflow");

        prototype.children.push(child);
        constant = new GenericConstant(GenericConstantType.Child, child);
      } else {
        throw Error("Invalid generic constant type");
      }

      prototype.constants.unshift(constant);
    }

    for (let i = 0; i < nkcount; ++i) {
      const [ isDouble, first ] = this.m_bs.readULEB128_33();
      let value;

      if (isDouble) {
        const second = this.m_bs.readULEB128();
        value = bitCast("uint64", first | (second << 32), "double");
      } else {
        value = normalizeNumberSign(first, 4);
      }

      prototype.numbers.unshift(Number(value));
    }

    if (dbgsize > 0) {
      const debugInfo = prototype.debugInfo as PrototypeDebugInfo;
      
      let lineNumSize = 1;
      if (debugInfo.linesCount > 255)
        lineNumSize = 2;
      else if (debugInfo.linesCount > 65535)
        lineNumSize = 4;

      for (let i = 0; i < cdcount; ++i) {
        debugInfo.lines.push(this.m_bs.readu(lineNumSize));
      }

      for (let i = 0; i < uvcount; ++i) {
        let name = "";

        for (;;) {
          const byte = this.m_bs.readu8();
          if (byte === 0)
            break;
          name += String.fromCharCode(byte);
        }

        debugInfo.upvalues.push(name);
      }

      while (true) {
        let name = "";
        let n = this.m_bs.readu8();
        
        if (n < 7) {
          if (n === 0)
            break;
        } else {
          for (;;) {
            name += String.fromCharCode(n);
            n = this.m_bs.readu8();
            if (n === 0)
              break;
          }
        }

        const startpc = this.m_bs.readULEB128();
        const len = this.m_bs.readULEB128();
        
        const local = new PrototypeLocalDebugInfo();

        if (n < 7) {
          local.special = n;
          switch (n) {
            case 1:
              name = "(for index)";
              break;
            case 2:
              name = "(for limit)";
              break;
            case 3:
              name = "(for step)";
              break;
            case 4:
              name = "(for generator)";
              break;
            case 5:
              name = "(for state)";
              break;
            case 6:
              name = "(for control)";
              break;
          }
        } else {
          local.special = 0;
        }

        local.scopeBegin = startpc;
        local.scopeLength = len;
        local.name = name;
        debugInfo.locals.push(local);
      }
    }

    this.m_stack.push(prototype);
  }

  parse() {
    this.m_bs.seek(0);

    const magic = this.m_bs.readString(3);
    
    if (magic !== "\x1BLJ")
      throw Error("Invalid magic");

    this.parseHeader();

    while (true) {
      if (this.m_bs.readu8() === 0)
        break;
      this.m_bs.skip(-1);

      this.parsePrototype();
    }

    if (this.m_stack.length === 0)
      throw Error("Corrupted bytecode: no global chunk");

    this.m_s.global = this.m_stack.pop() as Prototype;
  }
};
