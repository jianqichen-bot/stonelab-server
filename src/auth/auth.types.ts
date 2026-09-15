export interface AccessTokenPayload {
  sub: string;
  username: string;
  roles: string[];
  type: 'access';
}

export interface RefreshTokenPayload {
  jti: string;
  sub: string;
  type: 'refresh';
}

export type RequestUser = AccessTokenPayload;
