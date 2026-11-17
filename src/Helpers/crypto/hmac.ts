/* -------------------------------------------------------------------------- */
/*  HMAC-SHA256 (RFC 2104) — primitiva de D2, SIN CABLEAR.                    */
/*                                                                            */
/*  No se escribe un SHA-256 nuevo: se reutiliza el de `passwordHash.ts`      */
/*  (el camino ya demostrado aquí, comprobado contra `crypto` de Node). Este  */
/*  fichero solo da a HMAC un sitio estable en `Helpers/crypto/`.             */
/*                                                                            */
/*  Estado: NO está cableado a nada (ni `Patient`, ni la base de datos). La   */
/*  custodia de la clave es responsabilidad del llamante.                     */
/* -------------------------------------------------------------------------- */
export { hmacSha256, sha256 } from '@/Helpers/passwordHash';
