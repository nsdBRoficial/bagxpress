/**
 * src/types/bs58.d.ts
 *
 * PT-BR: Declaração de tipo manual para o módulo `bs58` (sem @types/bs58 no npm).
 * EN:    Manual type declaration for the `bs58` module (no @types/bs58 on npm).
 *
 * O módulo bs58 v5.x exporta diretamente as funções encode/decode (sem export default).
 * The bs58 v5.x module exports encode/decode functions directly (no default export).
 */
declare module "bs58" {
  /**
   * PT-BR: Codifica um Uint8Array em uma string Base58.
   * EN:    Encodes a Uint8Array into a Base58 string.
   */
  export function encode(source: Uint8Array | Buffer): string;

  /**
   * PT-BR: Decodifica uma string Base58 em um Uint8Array. Lança erro se inválido.
   * EN:    Decodes a Base58 string into a Uint8Array. Throws if invalid.
   */
  export function decode(string: string): Uint8Array;

  /**
   * PT-BR: Decodifica uma string Base58 de forma segura (retorna undefined se inválido).
   * EN:    Safely decodes a Base58 string (returns undefined if invalid).
   */
  export function decodeUnsafe(string: string): Uint8Array | undefined;
}
