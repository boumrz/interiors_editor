import { hasOnlyUnicodeScalarValues } from './unicode-scalar-values';

export type ProjectNameValidation =
  | { readonly kind: 'valid'; readonly name: string }
  | {
      readonly kind: 'rejected';
      readonly reasonCode: 'PROJECT_NAME_REQUIRED' | 'PROJECT_NAME_INVALID_UNICODE';
    };

export function validateProjectName(value: string): ProjectNameValidation {
  const name = value.trim();
  if (name === '') return { kind: 'rejected', reasonCode: 'PROJECT_NAME_REQUIRED' };
  return hasOnlyUnicodeScalarValues(name)
    ? { kind: 'valid', name }
    : { kind: 'rejected', reasonCode: 'PROJECT_NAME_INVALID_UNICODE' };
}
