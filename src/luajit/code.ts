import { Opcode, OpcodeInfo, getOpcodeInfo } from "./opcodes";

export class Instruction {
  opcode: Opcode
  private args: Map<string, number>
  private opcodeInfo: OpcodeInfo

  constructor(opcode: number) {
    this.opcode = opcode;
    this.args = new Map();
    this.opcodeInfo = getOpcodeInfo(opcode);
  }

  private arg(name: string, value?: number): number | void {
    if (value !== undefined) {
      this.args.set(name, value);
    } else {
      return this.args.get(name);
    }
  }

  A(): number;
  A(value: number): void;
  A(value?: number): number | void {
    if (!this.opcodeInfo.canA())
      throw Error("Trying to access unexisting instruction argument");
    return this.arg("a", value);
  }
  

  B(): number;
  B(value: number): void;
  B(value?: number): number | void {
    if (!this.opcodeInfo.canB())
      throw Error("Trying to access unexisting instruction argument");
    return this.arg("b", value);
  }
  

  C(): number;
  C(value: number): void;
  C(value?: number): number | void {
    if (!this.opcodeInfo.canC())
      throw Error("Trying to access unexisting instruction argument");
    return this.arg("c", value);
  }
  

  D(): number;
  D(value: number): void;
  D(value?: number): number | void {
    if (!this.opcodeInfo.canD())
      throw Error("Trying to access unexisting instruction argument");
    return this.arg("d", value);
  }
};

export class Code {
  instructions: Instruction[]

  constructor() {
    this.instructions = [];
  }

  push(inst: Instruction) {
    this.instructions.push(inst);
  }

  pop(index?: number) {
    if (index === undefined)
      this.instructions.pop();
    else
      this.instructions.splice(index);
  }
};
