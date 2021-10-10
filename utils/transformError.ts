const util = require('util');

export const transformError = (error: Object | string) => !error ?  `Unknown error` : typeof error === "string" ? error : util.inspect(error, { showHidden: false, depth: null });