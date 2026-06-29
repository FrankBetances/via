/* -------------------------------------------------------------------------- */
/*  Tipo genérico de respuesta paginada usado por los hooks createLocalQuery/  */
/*  createLocalLazyQuery del servicio local (ver Services/local/core).         */
/* -------------------------------------------------------------------------- */

export interface PaginatedResponse<T> {
  results: T[];
  total: number;
  page?: number;
  pageSize?: number;
}
