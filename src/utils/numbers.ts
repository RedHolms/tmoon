type BitCastType = "double" | "uint64";

export function bitCast(from: BitCastType, value: number | bigint, to: BitCastType): number | bigint;
export function bitCast(from: "uint64", value: bigint, to: "double"): number;
export function bitCast(from: "double", value: number, to: "uint64"): bigint;

export function bitCast(from: BitCastType, value: number | bigint, to: BitCastType): number | bigint {
  if (from === to)
    return value;

  let buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  
  switch (from) {
    case "uint64":
      view.setBigUint64(0, value as bigint);
      break;
    case "double":
      view.setFloat64(0, value as number);
      break;
  }
  
  switch (to) {
    case "uint64":
      return view.getBigUint64(0);
    case "double":
      return view.getFloat64(0);
  }
}

export function normalizeNumberSign(value: bigint | number, bytes: number): bigint {
  if (typeof value === "number")
    value = BigInt(value);

  const signMask = BigInt(1 << ((bytes * 8) - 1));

  if ((value & signMask) !== 0n) {
    return BigInt(-1 & ~((1 << (bytes * 8)) - 1)) | value;
  } else {
    return value;
  }
}
