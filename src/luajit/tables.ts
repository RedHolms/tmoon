export enum TableValueType {
  Nil = 0,
  False = 1,
  True = 2,
  Int32 = 3,
  Int64 = 4,
  String = 5
};

type TableRealValue = bigint | string | "nil" | "true" | "false";

export class TableValue {
  type: TableValueType
  value: TableRealValue

  constructor(type: TableValueType.Nil, value: "nil");
  constructor(type: TableValueType.False, value: "false");
  constructor(type: TableValueType.True, value: "true");
  constructor(type: TableValueType.Int32 | TableValueType.Int64, value: bigint);
  constructor(type: TableValueType.String, value: string);
  constructor(type: TableValueType, value: TableRealValue);

  constructor(type: TableValueType, value: TableRealValue) {
    this.type = type;
    this.value = value;
  }
};

export class TableDictionaryNode {
  key: TableValue
  value: TableValue

  constructor(key: TableValue, value: TableValue) {
    this.key = key;
    this.value = value;
  }
};

export class Table {
  private list: TableValue[];

  // Map will only make it worse
  private dict: TableDictionaryNode[];

  constructor() {
    this.list = [];
    this.dict = [];
  }
  
  private tryGetList(index: number | bigint): TableValue | undefined {
    if (typeof index === "bigint")
      index = Number(index);

    return this.list.at(index);
  }

  private tryGetDict(key: TableValue): TableValue | undefined {
    for (const node of this.dict) {
      if (
        node.key.type === key.type &&
        node.key.value === key.value
      ) {
        return node.value;
      }
    }

    return undefined;
  }

  array(): TableValue[] {
    return this.list;
  }

  dictionary(): TableDictionaryNode[] {
    return this.dict;
  }

  get(index: number): TableValue | undefined;
  get(key: TableValue): TableValue | undefined;

  get(key: number | TableValue): TableValue | undefined {
    if (typeof key === "number" || typeof key === "bigint") {
      const value = this.tryGetList(key);
      if (value)
        return value;
    }

    if (typeof key === "number")
      return undefined;

    return this.tryGetDict(key);
  }

  set(key: TableValue, value: TableValue): void;
  set(key: TableValue, type: TableValueType, value: TableRealValue): void;

  /* Note! This function only sets values to dict part */
  set(key: TableValue, valueOrType: TableValueType | TableValue, realValue?: TableRealValue) {
    let value: TableValue;

    if (valueOrType instanceof TableValue)
      value = valueOrType;
    else
      value = new TableValue(valueOrType, realValue as TableRealValue);

    // Is there already node with this key
    let existingNode: TableDictionaryNode | undefined = undefined;
    for (const node of this.dict) {
      if (node.key.value === key.value) {
        existingNode = node;
        break;
      }
    }

    if (existingNode) {
      existingNode.value = value;
    } else {
      const newNode = new TableDictionaryNode(key, value);
      this.dict.push(newNode);
    }
  }

  delete(key: TableValue) {
    for (let i = 0; i < this.dict.length; ++i) {
      const node = this.dict[i];

      if (
        node.key.type === key.type &&
        node.key.value === key.value
      ) {
        this.dict.splice(i, 1);
        break;
      }
    }
  }
  
  push(index: number, value: TableValue): void;
  push(index: number, type: TableValueType, value: TableRealValue): void;

  push(index: number, valueOrType: TableValueType | TableValue, realValue?: TableRealValue) {
    let value: TableValue;

    if (valueOrType instanceof TableValue)
      value = valueOrType;
    else
      value = new TableValue(valueOrType, realValue as TableRealValue);

    if (this.list.length - 1 > index) {
      const prevLength = this.list.length;
      this.list.length = index + 1;

      for (let i = prevLength; i < this.list.length - 1; ++i) {
        this.list[i] = new TableValue(TableValueType.Nil, "nil");
      }
    }

    this.list[index] = value;
  }

  pop(index: number) {
    this.list.splice(index, 1);
  }
};
