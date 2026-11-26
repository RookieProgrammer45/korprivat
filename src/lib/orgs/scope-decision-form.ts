import {
  AUTHORIZATION_SCOPES,
  type AuthorizationScope,
} from '@/lib/orgs/school-authorization-policy';

export type ScopeDecisionFormState = Record<AuthorizationScope, false>;

/** SC-21a / UX-13: the form never starts with a scope selected. */
export function emptyScopeDecisionForm(): ScopeDecisionFormState {
  return {
    availability_display: false,
    inquiry_collection: false,
    request_to_book: false,
    transactional_booking: false,
    payment_collection: false,
  };
}

export function conciergeMayPrefillScopes(payload: unknown): false {
  void payload;
  return false;
}

export function selectedScopesFromForm(
  state: Partial<Record<AuthorizationScope, boolean>>,
): AuthorizationScope[] {
  return AUTHORIZATION_SCOPES.filter((scope) => state[scope] === true);
}
