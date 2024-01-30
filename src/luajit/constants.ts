import Complex from "complex";

import { Prototype } from "./prototype";
import { Table } from "./tables";

export enum GenericConstantType {
  Child = 0,
  Table = 1,
  Int64 = 2,
  Uint64 = 3,
  Complex = 4,
  String = 5
};

export type GenericConstantValue
  = Prototype | Table |
    bigint | Complex |
    string;

export class GenericConstant {
  type: GenericConstantType
  value: GenericConstantValue

  constructor(type: GenericConstantType.Child, value: Prototype);
  constructor(type: GenericConstantType.Table, value: Table);
  constructor(type: GenericConstantType.Int64, value: bigint);
  constructor(type: GenericConstantType.Uint64, value: bigint);
  constructor(type: GenericConstantType.Complex, value: Complex);
  constructor(type: GenericConstantType.String, value: string);
  constructor(type: GenericConstantType, value: GenericConstantValue);
  
  constructor(type: GenericConstantType, value: GenericConstantValue) {
    this.type = type;
    this.value = value;
  }
};
