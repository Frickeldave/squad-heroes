export const INCOMPATIBLE_SQUAD_EXIT = 2;

export class HeroesError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'HeroesError';
    this.code = code;
    this.details = details;
  }
}

export function fail(code, message, details) {
  throw new HeroesError(code, message, details);
}
