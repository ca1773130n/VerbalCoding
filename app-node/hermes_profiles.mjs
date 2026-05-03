export class InvalidProfileName extends Error {
  constructor(name) {
    super(`invalid Hermes profile name ${JSON.stringify(name)}: must match ^[a-z0-9][a-z0-9_-]{0,63}$`);
    this.name = 'InvalidProfileName';
  }
}

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function validateProfileName(name) {
  if (typeof name !== 'string' || !PROFILE_NAME_RE.test(name)) {
    throw new InvalidProfileName(name);
  }
  return name;
}
