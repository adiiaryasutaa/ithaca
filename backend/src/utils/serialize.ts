export function bigintToString(value: bigint): string;
export function bigintToString(value: bigint | null | undefined): string | null;
export function bigintToString(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}
